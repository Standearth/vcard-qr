# --- Configuration File ---
TFFILE := terraform.tfvars

# --- Configuration ---
PROJECT_ID      := $(shell grep 'gcp_project_id' $(TFFILE) 2>/dev/null | cut -d'=' -f2 | tr -d ' "')
BILLING_ACCOUNT  = $(shell gcloud billing accounts list --format='value(ACCOUNT_ID)' --filter='OPEN=true' | head -n 1)
PROJECT_EXISTS  := $(shell gcloud projects describe $(PROJECT_ID) >/dev/null 2>&1 && echo 1)

# --- Argument Parsing ---
KNOWN_TARGETS   := all setup create-project setup-project create-service-account create-workload-identity create-secrets add-secrets-placeholder add-secrets-local terraform-apply terraform-destroy help upload-signer-key upload-signer-cert upload-wwdr-cert show-github-secrets map-custom-domain check-domain-status add-local-https-certs add-private-key add-placeholder-certificate create-certificate-signing-request cer-to-pem set-backend-env-vars setup-artifact-cleanup

# This allows passing named arguments like `make target email=foo@bar.com`
$(foreach v, $(filter-out $(KNOWN_TARGETS),$(MAKECMDGOALS)), $(eval $(v)))

# This captures the first unlabelled argument passed after the target
ARG := $(firstword $(filter-out $(KNOWN_TARGETS) $(patsubst %-,-%,$(filter-out $(KNOWN_TARGETS),$(MAKECMDGOALS))),$(MAKECMDGOALS)))

# --- Certificate Filenames ---
SIGNER_KEY_FILE     = signerKey.key
SIGNER_CERT_FILE    = signerCert.pem
WWDR_CERT_FILE      = AppleWWDRCAG4.pem
LOCALHOST_KEY_FILE  = localhost.key
LOCALHOST_CERT_FILE = localhost.pem


# --- Other variables ---
PROJECT_NUM           = $(shell gcloud projects describe $(PROJECT_ID) --format="value(projectNumber)" 2>/dev/null)
REGION                = us-central1
SERVICE_NAME          = pkpass-server
SERVICE_ACCOUNT_NAME  = github-actions-runner
SERVICE_ACCOUNT_EMAIL = $(SERVICE_ACCOUNT_NAME)@$(PROJECT_ID).iam.gserviceaccount.com
WORKLOAD_POOL_ID      = github-actions-pool
WORKLOAD_PROVIDER_ID  = github-provider
GITHUB_REPO           = Standearth/vcard-qr
SECRET_KEY            = apple-wallet-signer-key
SECRET_CERT           = apple-wallet-signer-cert
SECRET_WWDR           = apple-wallet-wwdr-cert
CUSTOM_DOMAIN         = pkpass.stand.earth
REPO_NAME             = $(SERVICE_NAME)-repo

.PHONY: all setup create-project setup-project create-service-account create-workload-identity create-secrets add-secrets-placeholder add-secrets-local terraform-apply terraform-destroy help upload-signer-key upload-signer-cert upload-wwdr-cert show-github-secrets map-custom-domain check-domain-status add-local-https-certs add-private-key add-placeholder-certificate create-certificate-signing-request cer-to-pem set-backend-env-vars

# Default target
all: help

# Helper target to ensure GCP project is set
check-gcp-project:
	@if [ -z "$(PROJECT_ID)" ]; then \
		echo "❌ Error: GCP Project ID is not set. Please run 'make setup' first to create terraform.tfvars."; \
		exit 1; \
	fi
	@gcloud config set project $(PROJECT_ID)

## --------------------------------------
## Full Setup from Scratch
## --------------------------------------

setup: create-project setup-project create-service-account create-workload-identity create-secrets add-secrets-placeholder setup-artifact-cleanup show-github-secrets
	@echo "✅ Full one-time setup is complete. Run 'make terraform-apply' to deploy infrastructure."

## --------------------------------------
## One-Time Project Setup (Step-by-Step)
## --------------------------------------

create-project:
	@if [ -n "$(PROJECT_EXISTS)" ]; then \
		echo "✅ Project '$(PROJECT_ID)' already exists. Skipping creation."; \
	else \
		echo "ℹ️ Project configuration file '$(TFFILE)' not found or project does not exist."; \
		read -p "Enter a globally unique ID for your new Google Cloud Project: " project_id; \
		if gcloud projects describe $$project_id >/dev/null 2>&1; then \
			echo "✅ Project '$$project_id' already exists."; \
		else \
			echo "⏳ Creating new project '$$project_id'..."; \
			gcloud projects create $$project_id; \
			echo "🔗 Linking project '$$project_id' to billing account '$(BILLING_ACCOUNT)'..."; \
			gcloud billing projects link $$project_id --billing-account=$(BILLING_ACCOUNT); \
		fi; \
		echo "gcp_project_id = \"$$project_id\"" > $(TFFILE); \
		echo "✅ Project setup complete and $(TFFILE) updated."; \
		echo "🔄 Setting active gcloud project to '$$project_id'..."; \
		gcloud config set project $$project_id; \
	fi

setup-project: check-gcp-project
	@echo "🛠️  Enabling required Google Cloud APIs for project $(PROJECT_ID)..."
	@sleep 15
	@gcloud services enable \
		iam.googleapis.com \
		serviceusage.googleapis.com \
		artifactregistry.googleapis.com \
		run.googleapis.com \
		secretmanager.googleapis.com \
		iamcredentials.googleapis.com \
		compute.googleapis.com \
		--project=$(PROJECT_ID)

create-service-account: check-gcp-project
	@echo "👤 Checking for Service Account '$(SERVICE_ACCOUNT_NAME)'..."
	@if gcloud iam service-accounts describe $(SERVICE_ACCOUNT_EMAIL) --project=$(PROJECT_ID) > /dev/null 2>&1; then \
		echo "✅ Service Account '$(SERVICE_ACCOUNT_NAME)' already exists."; \
	else \
		echo "   -> Service Account not found. Creating..."; \
		gcloud iam service-accounts create $(SERVICE_ACCOUNT_NAME) \
			--display-name="GitHub Actions Runner SA" \
			--description="Service account for GitHub Actions CI/CD" \
			--project=$(PROJECT_ID); \
	fi

create-workload-identity: check-gcp-project
	@echo "🔗 Setting up Workload Identity Federation for GitHub..."
	@echo "   -> Checking for Pool..."
	@if gcloud iam workload-identity-pools describe $(WORKLOAD_POOL_ID) --location="global" --project=$(PROJECT_ID) > /dev/null 2>&1; then \
		echo "✅ Workload Identity Pool '$(WORKLOAD_POOL_ID)' already exists."; \
	else \
		echo "   -> Pool not found. Creating..."; \
		gcloud iam workload-identity-pools create $(WORKLOAD_POOL_ID) \
			--location="global" \
			--display-name="GitHub Actions Pool" \
			--description="Pool for GitHub Actions" \
			--project=$(PROJECT_ID); \
	fi
	@echo "   -> Checking for Provider..."
	@if gcloud iam workload-identity-pools providers describe $(WORKLOAD_PROVIDER_ID) --workload-identity-pool=$(WORKLOAD_POOL_ID) --location="global" --project=$(PROJECT_ID) > /dev/null 2>&1; then \
		echo "✅ Workload Identity Provider '$(WORKLOAD_PROVIDER_ID)' already exists. Updating to ensure correct settings..."; \
		gcloud iam workload-identity-pools providers update-oidc $(WORKLOAD_PROVIDER_ID) \
			--workload-identity-pool=$(WORKLOAD_POOL_ID) \
			--location="global" \
			--attribute-mapping="google.subject=assertion.sub" \
			--attribute-condition="assertion.repository == '$(GITHUB_REPO)'" \
			--project=$(PROJECT_ID); \
	else \
		echo "   -> Provider not found. Creating..."; \
		gcloud iam workload-identity-pools providers create-oidc $(WORKLOAD_PROVIDER_ID) \
			--workload-identity-pool=$(WORKLOAD_POOL_ID) \
			--location="global" \
			--issuer-uri="https://token.actions.githubusercontent.com" \
			--attribute-mapping="google.subject=assertion.sub" \
			--attribute-condition="assertion.repository == '$(GITHUB_REPO)'" \
			--project=$(PROJECT_ID); \
	fi
	@echo "   -> Granting GitHub permission to impersonate Service Account (Token Creator)..."
	@gcloud iam service-accounts add-iam-policy-binding $(SERVICE_ACCOUNT_EMAIL) \
		--role="roles/iam.serviceAccountTokenCreator" \
		--member="principal://iam.googleapis.com/projects/$(PROJECT_NUM)/locations/global/workloadIdentityPools/$(WORKLOAD_POOL_ID)/subject/repo:$(GITHUB_REPO):ref:refs/heads/main" \
		--project=$(PROJECT_ID)
	@echo "   -> Granting GitHub permission to impersonate Service Account (Workload Identity User)..."
	@gcloud iam service-accounts add-iam-policy-binding $(SERVICE_ACCOUNT_EMAIL) \
		--role="roles/iam.workloadIdentityUser" \
		--member="principal://iam.googleapis.com/projects/$(PROJECT_NUM)/locations/global/workloadIdentityPools/$(WORKLOAD_POOL_ID)/subject/repo:$(GITHUB_REPO)" \
		--project=$(PROJECT_ID)

create-secrets: check-gcp-project
	@echo "🔑 Checking for required secrets..."
	@for secret in $(SECRET_KEY) $(SECRET_CERT) $(SECRET_WWDR); do \
		if gcloud secrets describe $$secret --project=$(PROJECT_ID) > /dev/null 2>&1; then \
			echo "✅ Secret '$$secret' already exists."; \
		else \
			echo "   -> Secret '$$secret' not found. Creating..."; \
			gcloud secrets create $$secret --replication-policy="automatic" --project=$(PROJECT_ID); \
		fi; \
	done

add-secrets-placeholder: create-secrets
	@echo "🔐 Checking if secrets need placeholder versions..."
	@if [ -z "$$(gcloud secrets versions list $(SECRET_KEY) --limit=1 --format='value(name)' --project=$(PROJECT_ID))" ]; then \
		echo "   -> No versions found for $(SECRET_KEY). Generating and uploading placeholder certificate..."; \
		openssl req -x509 -newkey rsa:2048 -keyout signerKey.pem -out signerCert.pem -days 365 -nodes -subj "/CN=stand.earth-dev-placeholder"; \
		gcloud secrets versions add $(SECRET_KEY) --data-file="signerKey.pem" --project=$(PROJECT_ID); \
		gcloud secrets versions add $(SECRET_CERT) --data-file="signerCert.pem" --project=$(PROJECT_ID); \
		gcloud secrets versions add $(SECRET_WWDR) --data-file="signerCert.pem" --project=$(PROJECT_ID); \
		rm signerKey.pem signerCert.pem; \
	fi

## --------------------------------------
## Local Development & Certificate Management
## --------------------------------------

dev:
	@echo "🚀 Starting frontend and backend development servers..."
	@pnpm dev

add-secrets-local: add-private-key add-placeholder-certificate
	@echo "✅ Local placeholder signer key and certificate created in server/certs."

add-private-key:
	@echo "🔐 Checking for local private key..."
	@mkdir -p server/certs
	@if [ -f server/certs/$(SIGNER_KEY_FILE) ]; then \
		echo "✅ Private key ($(SIGNER_KEY_FILE)) already exists. Skipping creation."; \
	else \
		echo "   -> Generating new private key: $(SIGNER_KEY_FILE)..."; \
		openssl genrsa -out server/certs/$(SIGNER_KEY_FILE) 2048; \
	fi

add-placeholder-certificate: add-private-key
	@echo "🔐 Checking for local placeholder certificate..."
	@if [ -f server/certs/$(SIGNER_CERT_FILE) ]; then \
		echo "✅ Placeholder certificate ($(SIGNER_CERT_FILE)) already exists. Skipping creation."; \
	else \
		echo "   -> Generating new placeholder certificate from key..."; \
		openssl req -new -x509 -key server/certs/$(SIGNER_KEY_FILE) -out server/certs/$(SIGNER_CERT_FILE) -days 365 -subj "/CN=localhost-placeholder"; \
	fi

create-certificate-signing-request: add-private-key
	@echo "🖋️  Generating Certificate Signing Request (CSR)..."
	@csr_output_file="server/certs/$(patsubst %.pem,%.csr,$(SIGNER_CERT_FILE))"; \
	if [ -f "$$csr_output_file" ]; then \
		echo "✅ CSR ($$csr_output_file) already exists. Skipping creation."; \
	else \
		email_address=$(or $(email),$(ARG)); \
		if [ -z "$$email_address" ]; then \
			read -p "   -> Please enter the email address for the CSR: " email_address; \
		fi; \
		echo "   -> Generating CSR with email $$email_address..."; \
		openssl req -new -key server/certs/$(SIGNER_KEY_FILE) -out "$$csr_output_file" \
			-subj "/C=US/ST=United States/L=/O=Apple Inc./OU=Apple Worldwide Developer Relations/CN=Apple Worldwide Developer Relations Certification Authority/emailAddress=$$email_address"; \
		echo "✅ CSR created at $$csr_output_file. Upload this file to the Apple Developer portal."; \
	fi

cer-to-pem:
	@arg='$(ARG)'; \
	if [ -z "$$arg" ]; then \
		echo "❌ Error: Missing file path. Usage: make cer-to-pem path/to/your/certificate.cer"; exit 1; \
	fi; \
	if [ ! -f "$$arg" ]; then echo "❌ Error: File not found at '$$arg'"; exit 1; fi; \
	output_file="$$(dirname $$arg)/$$(basename $$arg .cer).pem"; \
	echo "🔄 Converting '$$arg' (DER) to '$$output_file' (PEM)..."; \
	openssl x509 -inform DER -outform PEM -in "$$arg" -out "$$output_file"; \
	echo "✅ Conversion complete."

add-local-https-certs:
	@echo "🔐 Checking for local HTTPS certificates for localhost..."
	@if [ -f server/certs/$(LOCALHOST_KEY_FILE) ] && [ -f server/certs/$(LOCALHOST_CERT_FILE) ]; then \
		echo "✅ Local HTTPS certificates already exist in server/certs. Skipping creation."; \
	else \
		echo "   -> No local HTTPS certificates found. Generating..."; \
		openssl req -x509 -newkey rsa:2048 -nodes \
		  -keyout server/certs/$(LOCALHOST_KEY_FILE) \
		  -out server/certs/$(LOCALHOST_CERT_FILE) \
		  -subj "/C=US/ST=CA/L=SanFrancisco/O=LocalDev/CN=localhost" \
		  -days 365; \
		echo "✅ Local HTTPS certificates ($(LOCALHOST_KEY_FILE), $(LOCALHOST_CERT_FILE)) created in server/certs."; \
	fi

## --------------------------------------
## GitHub Actions Secrets
## --------------------------------------

show-github-secrets: check-gcp-project
	@echo "\n"
	@echo "********************************************************************************"
	@echo "✅ GitHub Actions Secrets"
	@echo "********************************************************************************"
	@echo "Go to your GitHub repository's Settings > Secrets and variables > Actions."
	@echo "Create or update the following repository secrets:"
	@echo ""
	@echo "Name: GCP_PROJECT_ID"
	@echo "Value: $(PROJECT_ID)"
	@echo ""
	@echo "Name: GCP_SERVICE_ACCOUNT"
	@echo "Value: $(SERVICE_ACCOUNT_EMAIL)"
	@echo ""
	@echo "Name: GCP_WORKLOAD_IDENTITY_PROVIDER"
	@echo "Value: projects/$(PROJECT_NUM)/locations/global/workloadIdentityPools/$(WORKLOAD_POOL_ID)/providers/$(WORKLOAD_PROVIDER_ID)"
	@echo ""
	@echo "********************************************************************************"
	@echo ""

## --------------------------------------
## Manual Secret Management
## --------------------------------------

upload-signer-key: check-gcp-project
	@arg='$(ARG)'; \
	if [ -z "$$arg" ]; then \
		read -p "Enter the local file path for the SIGNER KEY (e.g., /path/to/$(SIGNER_KEY_FILE)): " arg; \
	fi; \
	if [ ! -f "$$arg" ]; then echo "Error: File not found at '$$arg'"; exit 1; fi; \
	echo "   -> Uploading new version to $(SECRET_KEY) from '$$arg'..."; \
	gcloud secrets versions add $(SECRET_KEY) --data-file="$$arg" --project=$(PROJECT_ID)

upload-signer-cert: check-gcp-project
	@arg='$(ARG)'; \
	if [ -z "$$arg" ]; then \
		read -p "Enter the local file path for the SIGNER CERTIFICATE (e.g., /path/to/$(SIGNER_CERT_FILE)): " arg; \
	fi; \
	if [ ! -f "$$arg" ]; then echo "Error: File not found at '$$arg'"; exit 1; fi; \
	echo "   -> Uploading new version to $(SECRET_CERT) from '$$arg'..."; \
	gcloud secrets versions add $(SECRET_CERT) --data-file="$$arg" --project=$(PROJECT_ID)

upload-wwdr-cert: check-gcp-project
	@arg='$(ARG)'; \
	if [ -z "$$arg" ]; then \
		read -p "Enter the local file path for the WWDR CERTIFICATE (e.g., /path/to/$(WWDR_CERT_FILE)): " arg; \
	fi; \
	if [ ! -f "$$arg" ]; then echo "Error: File not found at '$$arg'"; exit 1; fi; \
	echo "   -> Uploading new version to $(SECRET_WWDR) from '$$arg'..."; \
	gcloud secrets versions add $(SECRET_WWDR) --data-file="$$arg" --project=$(PROJECT_ID)

## --------------------------------------
## Environment Variable Management
## --------------------------------------

set-backend-env-vars: check-gcp-project
	@echo "📡 Configuring environment variables for Cloud Run service '$(SERVICE_NAME)'..."
	@if [ ! -f .env ]; then \
		echo "   -> .env file not found. Will prompt for values."; \
		read -p "Enter PASS_TEAM_ID: " pass_team_id; \
		read -p "Enter PASS_TYPE_ID: " pass_type_id; \
		read -p "Enter VITE_ORG_NAME: " vite_org_name; \
		read -p "Enter PASS_DESCRIPTION: " pass_description; \
	else \
		echo "   -> Reading configuration from .env file..."; \
		pass_team_id=$$(grep PASS_TEAM_ID .env | cut -d '=' -f2 | tr -d '\"'); \
		pass_type_id=$$(grep PASS_TYPE_ID .env | cut -d '=' -f2 | tr -d '\"'); \
		vite_org_name=$$(grep VITE_ORG_NAME .env | cut -d '=' -f2 | tr -d '\"'); \
		pass_description=$$(grep PASS_DESCRIPTION .env | cut -d '=' -f2 | tr -d '\"'); \
	fi; \
	echo "   -> Applying variables to Cloud Run service..."; \
	gcloud run services update $(SERVICE_NAME) \
		--region=$(REGION) \
		--project=$(PROJECT_ID) \
		--update-env-vars="NODE_ENV=production,PASS_TEAM_ID=$$pass_team_id,PASS_TYPE_ID=$$pass_type_id,VITE_ORG_NAME=$$vite_org_name,PASS_DESCRIPTION=$$pass_description"

## --------------------------------------
## Infrastructure Management
## --------------------------------------

terraform-apply: check-gcp-project
	@echo "🏗️  Applying Terraform configuration for project $(PROJECT_ID)..."
	@terraform init
	@terraform apply -auto-approve

terraform-destroy: check-gcp-project
	@echo "🔥 Destroying all managed infrastructure for project $(PROJECT_ID)..."
	@terraform destroy -auto-approve

map-custom-domain: check-gcp-project
	@echo "🌐 Mapping custom domain '$(CUSTOM_DOMAIN)' to service '$(SERVICE_NAME)'..."
	@echo "   -> This requires that you have already configured a CNAME record pointing to ghs.googlehosted.com."
	@-gcloud beta run domain-mappings create \
		--service=$(SERVICE_NAME) \
		--domain=$(CUSTOM_DOMAIN) \
		--region=$(REGION) \
		--project=$(PROJECT_ID) || \
	echo "✅ Domain mapping may already exist. Check status with 'make check-domain-status'."

check-domain-status: check-gcp-project
	@echo "🔎 Checking status for custom domain '$(CUSTOM_DOMAIN)'..."
	@gcloud beta run domain-mappings describe --domain=$(CUSTOM_DOMAIN) --project=$(PROJECT_ID) --region=$(REGION)

setup-artifact-cleanup: terraform-apply
	@echo "🧹 Applying cleanup policy to Artifact Registry repository '$(REPO_NAME)'..."
	@gcloud artifacts repositories set-cleanup-policies $(REPO_NAME) \
		--policy=cleanup-policy.json \
		--location=$(REGION) \
		--project=$(PROJECT_ID)

## --------------------------------------
## Help
## --------------------------------------
help:
	@echo ""
	@echo "Usage: make [target] [arg] or [arg=value]"
	@echo ""
	@echo "--- LOCAL DEVELOPMENT ---"
	@echo "  dev                        Starts both frontend and backend servers via HTTP."
	@echo "  dev:https                  Starts both frontend and backend servers via HTTPS."
	@echo "  add-secrets-local          Generates placeholder PassKit key and cert for local use."
	@echo "  add-local-https-certs      Generates self-signed certificates for local HTTPS."
	@echo ""
	@echo "--- OFFICIAL CERTIFICATE WORKFLOW ---"
	@echo "  add-private-key            Generates a new private key for signing."
	@echo "  create-certificate-signing-request [your@email.com]"
	@echo "                             Generates a CSR from the private key to submit to Apple."
	@echo "  cer-to-pem [path/to/file.cer]"
	@echo "                             Converts a .cer certificate from Apple to the required .pem format."
	@echo ""
	@echo "--- FULL WORKFLOW ---"
	@echo "  setup                      Runs the full one-time setup process for a new project."
	@echo "  terraform-apply            Applies the Terraform infrastructure configuration."
	@echo "  terraform-destroy          Destroys all managed infrastructure."
	@echo "  setup-artifact-cleanup     Sets an automated 30-day cleanup policy on the Docker repository."
	@echo ""
	@echo "--- POST-DEPLOYMENT ---"
	@echo "  map-custom-domain          Maps your custom domain to the Cloud Run service."
	@echo "  check-domain-status        Checks the status of the custom domain mapping."
	@echo "  set-backend-env-vars       Sets runtime environment variables for the Cloud Run service."
	@echo ""
	@echo "--- GITHUB ACTIONS ---"
	@echo "  show-github-secrets        Displays the required secrets for your GitHub repository."
	@echo ""
	@echo "--- MANUAL SECRET MANAGEMENT ---"
	@echo "  upload-signer-key [path]   Upload a new version for the private key secret."
	@echo "  upload-signer-cert [path]  Upload a new version for the public certificate secret."
	@echo "  upload-wwdr-cert [path]    Upload a new version for the Apple WWDR certificate secret."
	@echo ""
	@echo "--- INDIVIDUAL SETUP STEPS ---"
	@echo "  create-project             Creates and configures a new GCP project if it doesn't exist."
	@echo "  setup-project              Enables all required Google Cloud APIs for the project."
	@echo "  create-service-account     Creates the service account used by GitHub Actions."
	@echo "  create-workload-identity   Sets up Workload Identity Federation for GitHub."
	@echo "  create-secrets             Creates empty secrets for the application."
	@echo "  add-secrets-placeholder    Adds placeholder certs only if secrets are empty."