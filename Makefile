# --- Configuration File ---
TFFILE := terraform.tfvars

# Require the .env file and export its variables.
# Make will now fail immediately if the .env file is not found.
include .env
export

# Define all variables required to be in the .env file for the setup to succeed.
REQUIRED_ENV_VARS := \
    FRONTEND_DOMAIN \
    BACKEND_DOMAIN \
    GITHUB_REPO \
    VITE_ORG_NAME \
    VITE_ORG_WEBSITE \
    VITE_OFFICE_PHONE_OPTIONS \
    PHOTO_SERVICE_URL

# Immediately check if all required variables are defined. If not, stop and show an error.
$(foreach var,$(REQUIRED_ENV_VARS), \
  $(if $(value $(var)),, \
    $(error ❌ Missing required variable in .env file: '$(var)'. Please define it and try again.) \
  ) \
)

# --- Configuration ---
PROJECT_ID      := $(shell cat $(TFFILE) 2>/dev/null | grep 'gcp_project_id' | cut -d'=' -f2 | tr -d ' "')
BILLING_ACCOUNT  = $(shell gcloud billing accounts list --format='value(ACCOUNT_ID)' --filter='OPEN=true' | head -n 1)
PROJECT_EXISTS  := $(shell gcloud projects describe $(PROJECT_ID) >/dev/null 2>&1 && echo 1)
ADC_FILE        = $(HOME)/.config/gcloud/application_default_credentials.json

# --- Argument Parsing & Target Validation ---
KNOWN_TARGETS   := all setup _setup_tasks create-project setup-project create-service-account create-workload-identity create-secrets add-secrets-placeholder add-secrets-local terraform-apply terraform-destroy help upload-signer-key upload-signer-cert upload-wwdr-cert show-github-secrets map-custom-domain check-domain-status add-local-https-certs add-private-key add-placeholder-certificate create-certificate-signing-request cer-to-pem cleanup-images-now gcloud-auth check-auth create-state-bucket check-env-vars update-tfvars upload-google-wallet-sa-key

# This captures the first unlabelled argument passed after the target
ARG := $(firstword $(filter-out $(KNOWN_TARGETS) $(MAKECMDGOALS),$(MAKECMDGOALS)))
# This allows passing named arguments like `make target email=foo@bar.com`
$(eval $(filter %=%, $(MAKECMDGOALS)))

# Validate that the user is running a known target
.DEFAULT_GOAL := help
FIRST_GOAL := $(firstword $(filter-out %=%,$(MAKECMDGOALS)))
ifneq ($(strip $(FIRST_GOAL)),)
  ifneq ($(filter $(FIRST_GOAL), $(KNOWN_TARGETS)), $(FIRST_GOAL))
    $(error Unknown target: '$(FIRST_GOAL)'. Run 'make help' for a list of valid targets.)
  endif
endif

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
SECRET_KEY            = apple-wallet-signer-key
SECRET_CERT           = apple-wallet-signer-cert
SECRET_WWDR           = apple-wallet-wwdr-cert
SECRET_GOOGLE_WALLET_SA_KEY = google-wallet-sa-key
REPO_NAME             = $(SERVICE_NAME)-repo

.PHONY: all setup _setup_tasks create-project setup-project create-service-account create-workload-identity create-secrets add-secrets-placeholder add-secrets-local terraform-apply terraform-destroy help upload-signer-key upload-signer-cert upload-wwdr-cert show-github-secrets map-custom-domain check-domain-status add-local-https-certs add-private-key add-placeholder-certificate create-certificate-signing-request cer-to-pem cleanup-images-now gcloud-auth check-auth create-state-bucket check-env-vars

# Default target
all: help

# Helper target to ensure essential .env variables are set
check-env-vars:
	@if [ -z "$(FRONTEND_DOMAIN)" ] || [ -z "$(BACKEND_DOMAIN)" ] || [ -z "$(GITHUB_REPO)" ]; then \
		echo "❌ Error: FRONTEND_DOMAIN, BACKEND_DOMAIN, or GITHUB_REPO is not set."; \
		echo "   Please copy .env.template to .env and configure these variables first."; \
		exit 1; \
	fi

# Helper target to ensure GCP project is set
check-gcp-project: check-auth
	@if [ -z "$(PROJECT_ID)" ]; then \
		echo "❌ Error: GCP Project ID is not set. Please run 'make setup' first to create terraform.tfvars."; \
		exit 1; \
	fi
	@gcloud config set project $(PROJECT_ID)

## --------------------------------------
## Authentication
## --------------------------------------

gcloud-auth:
	@echo "🔐 Authenticating for Google Cloud..."
	@echo "   -> Logging in for gcloud CLI..."
	@gcloud auth login
	@echo "   -> Providing credentials for Application Default Credentials (for Terraform)..."
	@gcloud auth application-default login
	@echo "✅ Authentication complete."

check-auth:
	@if [ -z "$$(gcloud config get-value account 2>/dev/null)" ]; then \
		echo "❌ Error: You are not logged into Google Cloud."; \
		echo "   Please run 'make gcloud-auth' or 'gcloud auth login' and try again."; \
		exit 1; \
	fi
	@if [ "$${CLOUD_SHELL}" != "true" ] && [ ! -f "$(ADC_FILE)" ]; then \
		echo "❌ Error: Application Default Credentials are not set."; \
		echo "   This is required for applications like Terraform to run locally."; \
		echo "   Please run 'make gcloud-auth' or 'gcloud auth application-default login' and try again."; \
		exit 1; \
	fi

## --------------------------------------
## Full Setup from Scratch
## --------------------------------------

setup: check-env-vars
	@if [ ! -f "$(TFFILE)" ]; then \
		echo "ℹ️  Configuration file not found. Running initial project creation first..."; \
		$(MAKE) create-project; \
		echo "🔄 Restarting setup process with new configuration..."; \
		$(MAKE) setup; \
	else \
		$(MAKE) _setup_tasks; \
	fi

_setup_tasks: create-project setup-project create-service-account create-workload-identity create-secrets add-secrets-placeholder create-state-bucket terraform-apply show-github-secrets
	@echo "✅ Full one-time setup is complete."

## --------------------------------------
## One-Time Project Setup (Step-by-Step)
## --------------------------------------

update-tfvars:
	@echo "🔄 Syncing .env and local JSON files to terraform.tfvars..."
	@node scripts/generate-tfvars.mjs

create-project: check-auth
	@if [ -f "$(TFFILE)" ]; then \
		echo "✅ $(TFFILE) already exists. Syncing from .env..."; \
		$(MAKE) update-tfvars; \
	else \
		echo "ℹ️  Project configuration file '$(TFFILE)' not found or project does not exist."; \
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
		$(MAKE) update-tfvars; \
		echo "✅ Project setup complete and $(TFFILE) updated."; \
		echo "🔄 Setting active gcloud project to '$$project_id'..."; \
		gcloud config set project $$project_id; \
	fi

setup-project: check-gcp-project
	@echo "🛠️   Enabling required Google Cloud APIs for project $(PROJECT_ID)..."
	@sleep 15
	@gcloud services enable \
		iam.googleapis.com \
		serviceusage.googleapis.com \
		artifactregistry.googleapis.com \
		run.googleapis.com \
		secretmanager.googleapis.com \
		iamcredentials.googleapis.com \
		compute.googleapis.com \
		walletobjects.googleapis.com \
		cloudresourcemanager.googleapis.com \
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
	@for secret in $(SECRET_KEY) $(SECRET_CERT) $(SECRET_WWDR) $(SECRET_GOOGLE_WALLET_SA_KEY); do \
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
		openssl req -x509 -newkey rsa:2048 -keyout signerKey.pem -out signerCert.pem -days 365 -nodes -subj "/CN=example.com-placeholder"; \
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

show-github-secrets: check-gcp-project check-env-vars
	@echo ""
	@echo "********************************************************************************"
	@echo "✅ GitHub Actions Secrets"
	@echo "********************************************************************************"
	@echo "Go to your GitHub repository's Settings > Secrets and variables > Actions."
	@echo "Create or update the following repository secrets:"
	@echo ""
	@echo " Name: GCP_PROJECT_ID"
	@echo "Value: $(PROJECT_ID)"
	@echo ""
	@echo " Name: GCP_SERVICE_ACCOUNT"
	@echo "Value: $(SERVICE_ACCOUNT_EMAIL)"
	@echo ""
	@echo " Name: GCP_WORKLOAD_IDENTITY_PROVIDER"
	@echo "Value: projects/$(PROJECT_NUM)/locations/global/workloadIdentityPools/$(WORKLOAD_POOL_ID)/providers/$(WORKLOAD_PROVIDER_ID)"
	@echo ""
	@echo " Name: FRONTEND_DOMAIN"
	@echo "Value: $(FRONTEND_DOMAIN)"
	@echo ""
	@echo " Name: BACKEND_DOMAIN"
	@echo "Value: $(BACKEND_DOMAIN)"
	@echo ""
	@echo " Name: VITE_ORG_NAME"
	@echo "Value: $(VITE_ORG_NAME)"
	@echo ""
	@echo " Name: VITE_ORG_WEBSITE"
	@echo "Value: $(VITE_ORG_WEBSITE)"
	@echo ""
	@echo " Name: VITE_OFFICE_PHONE_OPTIONS"
	@printf "Value: %s\n" "$$(echo "$$VITE_OFFICE_PHONE_OPTIONS" | cut -c 2- | rev | cut -c 2- | rev)"
	@echo ""
	@echo " Name: VITE_LOGOS_CONFIG"
	@printf 'Value: %s\n' "$$(node -e 'process.stdout.write(JSON.stringify(JSON.parse(require(`fs`).readFileSync(`frontend/src/config/logos.json`, `utf-8`))))')"
	@echo ""
	@echo " Name: VITE_PRESETS_CONFIG"
	@printf 'Value: %s\n' "$$(node -e 'process.stdout.write(JSON.stringify(JSON.parse(require(`fs`).readFileSync(`frontend/src/config/presets.json`, `utf-8`))))')"
	@echo ""
	@echo " Name: GOOGLE_ISSUER_ID"
	@echo "Value: $(GOOGLE_ISSUER_ID)"
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

upload-google-wallet-sa-key: check-gcp-project
	@arg='$(ARG)'; \
	if [ -z "$$arg" ]; then \
		read -p "Enter the local file path for the Google Wallet Service Account Key (e.g., /path/to/google-wallet-sa-key.json): " arg; \
	fi; \
	if [ ! -f "$$arg" ]; then echo "Error: File not found at '$$arg'" ; exit 1; fi; \
	echo "   -> Uploading new version to $(SECRET_GOOGLE_WALLET_SA_KEY) from '$$arg'..."; \
	gcloud secrets versions add $(SECRET_GOOGLE_WALLET_SA_KEY) --data-file="$$arg" --project=$(PROJECT_ID)

## --------------------------------------
## Infrastructure Management
## --------------------------------------

create-state-bucket: check-gcp-project
	@echo "🏗️   Creating GCS bucket for Terraform state if it doesn't exist..."
	@if gsutil ls gs://$(PROJECT_ID)-tfstate > /dev/null 2>&1; then \
		echo "✅ GCS bucket gs://$(PROJECT_ID)-tfstate already exists."; \
	else \
		echo "   -> Creating GCS bucket gs://$(PROJECT_ID)-tfstate..."; \
		gsutil mb -p $(PROJECT_ID) -l $(REGION) gs://$(PROJECT_ID)-tfstate; \
		gsutil versioning set on gs://$(PROJECT_ID)-tfstate; \
	fi

terraform-apply: check-gcp-project create-secrets create-state-bucket update-tfvars
	@echo "🏗️   Applying Terraform configuration for project $(PROJECT_ID)..."
	@terraform init -backend-config="bucket=$(PROJECT_ID)-tfstate"
	@terraform apply -auto-approve

terraform-destroy: check-gcp-project
	@echo "🔥 Destroying all managed infrastructure for project $(PROJECT_ID)..."
	@terraform init -backend-config="bucket=$(PROJECT_ID)-tfstate"
	@terraform destroy -auto-approve

map-custom-domain: check-gcp-project check-env-vars
	@echo "🌐 Mapping custom domain '$(BACKEND_DOMAIN)' to service '$(SERVICE_NAME)'..."
	@echo "   -> This requires that you have already configured a CNAME record pointing to ghs.googlehosted.com."
	@-gcloud beta run domain-mappings create \
		--service=$(SERVICE_NAME) \
		--domain=$(BACKEND_DOMAIN) \
		--region=$(REGION) \
		--project=$(PROJECT_ID) || \
	echo "✅ Domain mapping may already exist. Check status with 'make check-domain-status'."

check-domain-status: check-gcp-project check-env-vars
	@echo "🔎 Checking status for custom domain '$(BACKEND_DOMAIN)'..."
	@gcloud beta run domain-mappings describe --domain=$(BACKEND_DOMAIN) --project=$(PROJECT_ID) --region=$(REGION)

cleanup-images-now: check-gcp-project
	@echo "🧹 Deleting all untagged images from Artifact Registry repository '$(REPO_NAME)'..."
	@gcloud artifacts docker images list $(REGION)-docker.pkg.dev/$(PROJECT_ID)/$(REPO_NAME) --filter='-tags:*' --format='get(digest)' --quiet | \
	while read digest; do \
		if [ -n "$$digest" ]; then \
			echo "   -> Deleting image with digest $$digest..."; \
			gcloud artifacts docker images delete $(REGION)-docker.pkg.dev/$(PROJECT_ID)/$(REPO_NAME)@$$digest --delete-tags --quiet; \
		fi; \
	done
	@echo "✅ Cleanup complete."

## --------------------------------------
## Help
## --------------------------------------
help:
	@echo ""
	@echo "Usage: make [target] [arg] or [arg=value]"
	@echo ""
	@echo "--- PREREQUISITES (Run Once Locally) ---"
	@echo "  gcloud-auth                Authenticates you with Google Cloud for both CLI and local applications."
	@echo ""
	@echo "--- LOCAL DEVELOPMENT ---"
	@echo "  dev                        Starts both frontend and backend servers via HTTPS."
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
	@echo ""
	@echo "--- INFRASTRUCTURE ---"
	@echo "  terraform-apply            Applies the Terraform infrastructure configuration."
	@echo "  terraform-destroy          Destroys all managed infrastructure."
	@echo "  create-state-bucket        Creates the GCS bucket for storing Terraform remote state."
	@echo "  cleanup-images-now         Immediately deletes all untagged Docker images from the repository."
	@echo ""
	@echo "--- POST-DEPLOYMENT ---"
	@echo "  map-custom-domain          Maps your custom domain to the Cloud Run service."
	@echo "  check-domain-status        Checks the status of the custom domain mapping."
	@echo ""
	@echo "--- GITHUB ACTIONS ---"
	@echo "  show-github-secrets        Displays the required secrets for your GitHub repository."
	@echo ""
	@echo "--- MANUAL SECRET MANAGEMENT ---"
	@echo "  upload-signer-key [path]   Upload a new version for the private key secret."
	@echo "  upload-signer-cert [path]  Upload a new version for the public certificate secret."
	@echo "  upload-wwdr-cert [path]    Upload a new version for the Apple WWDR certificate secret."
	@echo "  upload-google-wallet-sa-key [path] Upload a new version for the Google Wallet service account key secret."
	@echo ""
	@echo "--- INDIVIDUAL SETUP STEPS ---"
	@echo "  create-project             Creates and configures a new GCP project if it doesn't exist."
	@echo "  setup-project              Enables all required Google Cloud APIs for the project."
	@echo "  create-service-account     Creates the service account used by GitHub Actions."
	@echo "  create-workload-identity   Sets up Workload Identity Federation for GitHub."
	@echo "  create-secrets             Creates empty secrets for the application."
	@echo "  add-secrets-placeholder    Adds placeholder certs only if secrets are empty."