# --- Configuration File ---
TFFILE := terraform.tfvars

# --- Configuration ---
PROJECT_ID    := $(shell grep 'gcp_project_id' $(TFFILE) 2>/dev/null | cut -d'=' -f2 | tr -d ' "')
BILLING_ACCOUNT = $(shell gcloud billing accounts list --format='value(ACCOUNT_ID)' --filter='OPEN=true' | head -n 1)

PROJECT_EXISTS := $(shell gcloud projects describe $(PROJECT_ID) >/dev/null 2>&1 && echo 1)

# --- Argument Parsing ---
# This captures any argument that isn't a known target, making it available as a file path.
KNOWN_TARGETS         := all setup create-project setup-project create-service-account create-workload-identity create-secrets add-secrets-placeholder add-secrets-local terraform-apply terraform-destroy help upload-signer-key upload-signer-cert upload-wwdr-cert show-github-secrets map-custom-domain check-domain-status
FILE_PATH             := $(filter-out $(KNOWN_TARGETS),$(MAKECMDGOALS))
$(FILE_PATH): ;

# --- Certificate Filenames ---
SIGNER_KEY_FILE = Stand-PassKit.key
SIGNER_CERT_FILE = Stand-PassKit.pem
WWDR_CERT_FILE = AppleWWDRCAG4.pem
LOCALHOST_KEY_FILE = localhost.key
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

.PHONY: all setup create-project setup-project create-service-account create-workload-identity create-secrets add-secrets-placeholder add-secrets-local terraform-apply terraform-destroy help upload-signer-key upload-signer-cert upload-wwdr-cert show-github-secrets map-custom-domain check-domain-status

# Default target
all: help

## --------------------------------------
## Full Setup from Scratch
## --------------------------------------

setup: create-project setup-project create-service-account create-workload-identity create-secrets add-secrets-placeholder show-github-secrets
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
	fi



setup-project: create-project
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

create-service-account: create-project
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

create-workload-identity: create-project
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

create-secrets: create-project
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

## --------------------------------------
## Local Development
## --------------------------------------

dev:
	@echo "🚀 Starting frontend and backend development servers..."
	@pnpm dev

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

add-secrets-local:
	@echo "🔐 Checking for local placeholder signer certificates..."
	@if [ -f server/certs/$(SIGNER_KEY_FILE) ] || [ -f server/certs/$(SIGNER_CERT_FILE) ]; then \
		echo "✅ Local signer certificates already exist in server/certs. Skipping creation."; \
	else \
		echo "   -> No local signer certificates found. Generating..."; \
		mkdir -p server/certs; \
		openssl req -x509 -newkey rsa:2048 -keyout server/certs/$(SIGNER_KEY_FILE) -out server/certs/$(SIGNER_CERT_FILE) -days 365 -nodes -subj "/CN=localhost"; \
		echo "✅ Local signer certificates created in server/certs."; \
	fi

## --------------------------------------
## GitHub Actions Secrets
## --------------------------------------

show-github-secrets: create-project
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

upload-signer-key: create-project
	@file_path='$(FILE_PATH)'; \
	if [ -z "$$file_path" ]; then \
		read -p "Enter the local file path for the SIGNER KEY (e.g., /path/to/$(SIGNER_KEY_FILE)): " file_path; \
	fi; \
	if [ ! -f "$$file_path" ]; then echo "Error: File not found at '$$file_path'"; exit 1; fi; \
	echo "   -> Uploading new version to $(SECRET_KEY) from '$$file_path'..."; \
	gcloud secrets versions add $(SECRET_KEY) --data-file="$$file_path" --project=$(PROJECT_ID)

upload-signer-cert: create-project
	@file_path='$(FILE_PATH)'; \
	if [ -z "$$file_path" ]; then \
		read -p "Enter the local file path for the SIGNER CERTIFICATE (e.g., /path/to/$(SIGNER_CERT_FILE)): " file_path; \
	fi; \
	if [ ! -f "$$file_path" ]; then echo "Error: File not found at '$$file_path'"; exit 1; fi; \
	echo "   -> Uploading new version to $(SECRET_CERT) from '$$file_path'..."; \
	gcloud secrets versions add $(SECRET_CERT) --data-file="$$file_path" --project=$(PROJECT_ID)

upload-wwdr-cert: create-project
	@file_path='$(FILE_PATH)'; \
	if [ -z "$$file_path" ]; then \
		read -p "Enter the local file path for the WWDR CERTIFICATE (e.g., /path/to/$(WWDR_CERT_FILE)): " file_path; \
	fi; \
	if [ ! -f "$$file_path" ]; then echo "Error: File not found at '$$file_path'"; exit 1; fi; \
	echo "   -> Uploading new version to $(SECRET_WWDR) from '$$file_path'..."; \
	gcloud secrets versions add $(SECRET_WWDR) --data-file="$$file_path" --project=$(PROJECT_ID)

## --------------------------------------
## Infrastructure Management
## --------------------------------------

terraform-apply: create-project
	@echo "🏗️  Applying Terraform configuration for project $(PROJECT_ID)..."
	@terraform init
	@terraform apply -auto-approve

terraform-destroy: create-project
	@echo "🔥 Destroying all managed infrastructure for project $(PROJECT_ID)..."
	@terraform destroy -auto-approve

map-custom-domain: terraform-apply
	@echo "🌐 Mapping custom domain '$(CUSTOM_DOMAIN)' to service '$(SERVICE_NAME)'..."
	@echo "   -> This requires that you have already configured a CNAME record pointing to ghs.googlehosted.com."
	@-gcloud beta run domain-mappings create \
		--service=$(SERVICE_NAME) \
		--domain=$(CUSTOM_DOMAIN) \
		--region=$(REGION) \
		--project=$(PROJECT_ID) || \
	echo "✅ Domain mapping may already exist. Check status with 'make check-domain-status'."

check-domain-status: create-project
	@echo "🔎 Checking status for custom domain '$(CUSTOM_DOMAIN)'..."
	@gcloud beta run domain-mappings describe --domain=$(CUSTOM_DOMAIN) --project=$(PROJECT_ID) --region=$(REGION)

## --------------------------------------
## Help
## --------------------------------------
help:
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "--- LOCAL DEVELOPMENT ---"
	@echo "  dev                        Starts both frontend and backend servers."
	@echo "  add-local-https-certs      Generates self-signed certificates for local HTTPS."
	@echo "  add-secrets-local          Generates placeholder PassKit certs for local development."
	@echo ""
	@echo "--- FULL WORKFLOW ---"
	@echo "  setup                      Runs the full one-time setup process for a new project."
	@echo "  terraform-apply            Applies the Terraform infrastructure configuration."
	@echo "  terraform-destroy          Destroys all managed infrastructure."
	@echo ""
	@echo "--- POST-DEPLOYMENT ---"
	@echo "  map-custom-domain          Maps your custom domain to the Cloud Run service."
	@echo "  check-domain-status        Checks the status of the custom domain mapping."
	@echo ""
	@echo "--- GITHUB ACTIONS ---"
	@echo "  show-github-secrets        Displays the required secrets for your GitHub repository."
	@echo ""
	@echo "--- MANUAL SECRET MANAGEMENT ---"
	@echo "  upload-signer-key          Upload a new version for the private key secret."
	@echo "  upload-signer-cert         Upload a new version for the public certificate secret."
	@echo "  upload-wwdr-cert           Upload a new version for the Apple WWDR certificate secret."
	@echo ""
	@echo "--- INDIVIDUAL SETUP STEPS ---"
	@echo "  create-project             Creates and configures a new GCP project if it doesn't exist."
	@echo "  setup-project              Enables all required Google Cloud APIs for the project."
	@echo "  create-service-account     Creates the service account used by GitHub Actions."
	@echo "  create-workload-identity   Sets up Workload Identity Federation for GitHub."
	@echo "  create-secrets             Creates empty secrets for the application."
	@echo "  add-secrets-placeholder    Adds placeholder certs only if secrets are empty."
	@echo "  add-secrets-local          Adds placeholder certs for local development."
