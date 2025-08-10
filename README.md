# QR Code Generator

A web-based QR Code and vCard generator for Stand.earth, structured as a modern monorepo.

## Features

- **vCard QR Code Generation:** Create "business card" QR codes that contain vCard contact information.
- **URL QR Code Generation:** Create QR codes to visit a link.
- **WiFi QR Code Generation:** Create QR codes to connect to a network.
- **Customizable QR Codes:** Adjust the appearance of the QR codes.
- **Real-time Preview:** See a live preview of the QR code as you type.
- **Apple Wallet Pass Generation:** Generate Apple Wallet passes from vCard data.
- **Automated Photo Lookup:** Automatically include a person's photo from the Stand.earth staff page and adds it to the Apple Wallet pass.

## Technologies Used

- **Monorepo Management**:
  - `pnpm` Workspaces
- **Frontend:**
  - HTML5
  - SCSS
  - TypeScript
  - Vite
  - [qr-code-styling](https://github.com/kozakdenys/qr-code-styling#readme)
- **Backend:**
  - Node.js
  - Express.js
  - TypeScript
- **Deployment & Infrastructure:**
  - GitHub Actions (CI/CD)
  - Terraform (Infrastructure as Code)
  - Google Cloud Platform (GCP)
    - Cloud Run
    - Secret Manager
  - GitHub Pages

## Configuration

This project uses environment variables for all organization-specific settings.

1.  **Create an Environment File:**
    Copy the template file to create your local configuration file. This file is ignored by Git and will not be committed.

    ```bash
    cp .env.template .env
    ```

2.  **Edit `.env`:**
    Open the `.env` file and fill in the values for your organization. This includes your Apple Developer Team ID, Pass Type ID, default organization name, and production domains.

### CI/CD and Production Environments

To deploy the application, you must configure these variables in your hosting environments.

#### Frontend (GitHub Pages)

The frontend is configured at build time. You must set the following as **Repository secrets** in your GitHub project under `Settings > Secrets and variables > Actions`:

- `VITE_ORG_NAME`
- `VITE_ORG_WEBSITE`
- `BACKEND_DOMAIN`

#### Backend (Google Cloud Run)

The backend uses runtime environment variables. After your initial deployment, you can set them by running the following `make` command. It will use the values from your local `.env` file or prompt you for them.

```bash
make set-backend-env-vars
```

## Installation and Development

This project uses a `Makefile` to streamline one-time setup tasks and `pnpm` for all development commands.

### Prerequisites

- [Node.js](https://nodejs.org/en/download/) (v22+ recommended)
- [pnpm](https://pnpm.io/installation) (v9+ recommended)
- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (for deployment to GCP)
- [Terraform](https://www.terraform.io/downloads.html) (for infrastructure provisioning)
- [OpenSSL](https://www.openssl.org/source/) (for generating local certificates)

### Local Development Setup

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/Standearth/vcard-qr.git
    cd vcard-qr
    ```

2.  **Install dependencies:**
    Run this single command from the project root. `pnpm` will install dependencies for all workspaces (`frontend`, `server`, `shared-utils`).

    ```bash
    pnpm install
    ```

3.  **Generate Local Certificates:**
    You need two sets of local certificates: one for PassKit signing and one for local HTTPS.

    ```bash
    # Generates placeholder certs for Apple Wallet signing
    make add-secrets-local

    # Generates self-signed certs for localhost (HTTPS)
    make add-local-https-certs
    ```

4.  **Start the development servers:**
    Run the `dev` command from the project root to start both the frontend and backend servers concurrently.

    ```bash
    pnpm dev
    ```

    - The servers will automatically use HTTPS if local certificates are found (see `make add-local-https-certs`).
    - The **frontend** will run on **`https://localhost:5173`**.
    - The **backend** will run on **`https://localhost:3000`**.

    When you first access `https://localhost:5173`, your browser will show a privacy warning. Click "Advanced" and "Proceed to..." to accept the self-signed certificate.

### Official PassKit Certificate Workflow

To generate a pass that can be installed on real devices, you must use an official certificate from Apple. The `Makefile` provides utilities to assist with this multi-step process. You can override the default filenames (`signerKey.key`, `signerCert.pem`) by passing them as arguments to the make command (e.g., `make add-private-key SIGNER_KEY_FILE=MyNewKey.key`).

1.  **Create a Private Key:**
    This command generates a new private key in the `server/certs/` directory. By default, it creates `signerKey.key`.

    ```bash
    make add-private-key
    ```

2.  **Create a Certificate Signing Request (CSR):**
    This command uses your private key to generate a CSR. The output filename will be based on the `SIGNER_CERT_FILE` variable (e.g., `signerCert.csr`). You can provide your Apple Developer email as a named or positional argument, or be prompted for it interactively.

    ```bash
    make create-certificate-signing-request your.email@example.com
    ```

    Upload the resulting `.csr` file to the Apple Developer portal when creating a new Pass Type ID certificate.

3.  **Convert Apple Certificates to PEM Format:**
    After Apple processes your CSR, you will download a `.cer` file. You also need the Apple Worldwide Developer Relations (WWDR) intermediate certificate, which can be downloaded from the [Apple Certificate Authority](https://www.apple.com/certificateauthority/) page (specifically the "Worldwide Developer Relations - G4" certificate). Both of these `.cer` files are in DER format and must be converted to PEM format.

    The `cer-to-pem` command handles this conversion. Pass the path to your `.cer` file as an argument.

    ```bash
    # Convert your new signer certificate
    make cer-to-pem path/to/your/signerCert.cer

    # Convert the WWDR certificate
    make cer-to-pem path/to/your/AppleWWDRCAG4.cer
    ```

    This will create a new file with a `.pem` extension in the same directory.

4.  **Upload to Secret Manager:**
    Once you have your official `signerKey.key`, `signerCert.pem` (your converted signer cert), and `AppleWWDRCAG4.pem` files, upload them to Google Secret Manager for your production environment.
    ```bash
    make upload-signer-key path/to/signerKey.key
    make upload-signer-cert path/to/signerCert.pem
    make upload-wwdr-cert path/to/AppleWWDRCAG4.pem
    ```

## Deployment

Deployment is managed via Terraform and GitHub Actions.

### Hosting

The frontend is hosted on GitHub Pages. Frontend deployment is automated via the `.github/workflows/deploy.yml` GitHub Actions workflow, which builds the static site and creates a deployment artifact from the `dist/` directory. This artifact is then deployed directly to GitHub Page.

The frontend site is accessible at the custom domain `qr.stand.earth`, which is configured in the `CNAME` file and managed through GitHub Pages settings.

The backend is hosted on Google Cloud Run. Backend deployment is automated via the `./github/workflows/deploy-server.yml` GitHub Actions workflow, which builds and packages the node microservice for generating and signing Apple Wallet PassKit files, and then deploys that to Google Cloud Run.

The backend PassKit service is accessible at `pkpass.stand.earth`.

### CI/CD Pipeline (GitHub Actions)

The GitHub Actions workflows automate the deployment of the frontend to GitHub Pages and the backend to Google Cloud Run whenever changes are pushed to the `main` branch.

Monitor the progress of the deployment in the "Actions" tab of your GitHub repository.

### Deployment to Google Cloud Platform (GCP)

1.  **Initial GCP Project Setup:**

    > [!IMPORTANT]
    > Before you begin, make sure you have the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) installed and have authenticated as a user with sufficient permissions to create and manage Google Cloud projects.
    >
    > It is highly recommended to use [Google Cloud Shell](https://cloud.google.com/shell), as it comes pre-configured with the necessary tools and authentications, simplifying the setup process.

    Run the `setup` Makefile target to create and configure your GCP project, service accounts, and workload identity federation. This is a one-time setup.

    ```bash
    make setup
    ```

    Follow the prompts to enter a unique Google Cloud Project ID. This command will:
    - Create a new GCP project (if it doesn't exist).
    - Enable necessary Google Cloud APIs.
    - Create a service account for GitHub Actions.
    - Set up Workload Identity Federation for secure CI/CD.
    - Create empty secrets in Google Secret Manager for your Apple Wallet signing certificates.
    - Add placeholder certificates to Google Secret Manager if they are empty.

2.  **Configure GitHub Secrets:**
    After running `make setup`, display the required GitHub Actions secrets:

    ```bash
    make show-github-secrets
    ```

    Add these secrets to your GitHub repository under `Settings > Secrets and variables > Actions`.

3.  **Upload Apple Wallet Signing Certificates:**
    You will need your actual Apple Wallet signing key (`.key`), certificate (`.pem`), and the Apple Worldwide Developer Relations Certification Authority (WWDR) certificate (`.pem`). You can upload these to Google Secret Manager by passing the file path directly on the command line, which allows you to use shell tab-completion.

    These files are stored securely in Stand's 1Password `01` vault and should be treated as sensitive data.

    ```bash
    make upload-signer-key path/to/signerKey.key
    make upload-signer-cert path/to/signerCert.pem
    make upload-wwdr-cert path/to/AppleWWDRCAG4.pem
    ```

    If you run these commands without providing a file path, you will be prompted to enter it interactively.

4.  **Deploy Infrastructure with Terraform:**
    Apply the Terraform configuration to provision the Cloud Run service and other necessary GCP resources:

    ```bash
    make terraform-apply
    ```

5.  **Map Custom Domain (Optional):**
    If you have a custom domain, you can map it to your Cloud Run service. Ensure you have configured a CNAME record pointing to `ghs.googlehosted.com` first.
    ```bash
    make map-custom-domain
    ```
    You can check the status of your domain mapping:
    ```bash
    make check-domain-status
    ```

### Makefile Reference

Here's a quick reference for common `make` commands:

- **`make help`**: Displays all available Makefile targets and their descriptions.
- **`make setup`**: Performs initial GCP project setup.
- **`make add-secrets-local`**: Generates local placeholder certificates for development.
- **`make add-local-https-certs`**: Generates self-signed certificates for local HTTPS.
- **`make add-private-key`**: Generates a new private key for signing.
- **`make create-certificate-signing-request [email=your@email.com]`**: Generates a CSR from the private key to submit to Apple.
- **`make cer-to-pem [path/to/file.cer]`**: Converts a .cer certificate from Apple to the required .pem format.
- **`make terraform-apply`**: Deploys infrastructure via Terraform.
- **`make terraform-destroy`**: Destroys all managed infrastructure.
- **`make setup-artifact-cleanup-policy`**: Sets an automated 7-day cleanup policy for untagged images in the Docker repository.
- **`make cleanup-images-now`**: Immediately deletes all untagged Docker images from the repository.
- **`make show-github-secrets`**: Displays GitHub Actions secrets to be configured.
- **`make upload-signer-key [path/to/key]`**: Uploads your Apple Wallet signer key to Secret Manager.
- **`make upload-signer-cert [path/to/cert]`**: Uploads your Apple Wallet signer certificate to Secret Manager.
- **`make upload-wwdr-cert [path/to/wwdr]`**: Uploads your Apple WWDR certificate to Secret Manager.
- **`make map-custom-domain`**: Maps a custom domain to the Cloud Run service.
- **`make check-domain-status`**: Checks the status of the custom domain mapping.
````
