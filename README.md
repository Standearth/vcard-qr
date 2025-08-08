# QR Code Generator

A web-based QR Code and vCard generator for Stand.earth

## Credits

This project uses the [qr-code-styling](https://github.com/kozakdenys/qr-code-styling#readme) library for QR code generation.

## Installation and Development

This project uses a `Makefile` to streamline various development and deployment tasks. Below are the instructions for setting up your local environment and deploying the application.

### Prerequisites

*   [Node.js](https://nodejs.org/en/download/) (LTS version recommended)
*   [npm](https://www.npmjs.com/get-npm) (comes with Node.js)
*   [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (for deployment to GCP)
*   [Terraform](https://www.terraform.io/downloads.html) (for infrastructure provisioning)
*   [OpenSSL](https://www.openssl.org/source/) (for generating local certificates)
*   `rsvg-convert` (for converting SVG to PNG for Apple Wallet logos, install via `brew install librsvg` on macOS)

### Local Development Setup

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/Standearth/vcard-qr.git
    cd vcard-qr
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    npm install --prefix server
    ```

3.  **Generate local development certificates (for Apple Wallet pass generation):**

    ```bash
    make add-secrets-local
    ```

    This will create `Stand-PassKit.key` and `Stand-PassKit.pem` in the `server/certs/` directory. These are self-signed certificates for local testing only. The `AppleWWDRCAG4.pem` file should be manually placed in `server/certs/` if you have it, and it is already ignored by `.gitignore` except for that specific file.

4.  **Start the development servers:**

    ```bash
    npm run dev # For the frontend
    npm run dev --prefix server # For the backend API
    ```

    The frontend will typically run on `http://localhost:5173` and the backend on `http://localhost:3000`.

### Deployment to Google Cloud Platform (GCP)

Deployment is managed via Terraform and GitHub Actions.

1.  **Initial GCP Project Setup:**

    Run the `setup` Makefile target to create and configure your GCP project, service accounts, and workload identity federation. This is a one-time setup.

    ```bash
    make setup
    ```

    Follow the prompts to enter a unique Google Cloud Project ID. This command will:

    *   Create a new GCP project (if it doesn't exist).
    *   Enable necessary Google Cloud APIs.
    *   Create a service account for GitHub Actions.
    *   Set up Workload Identity Federation for secure CI/CD.
    *   Create empty secrets in Google Secret Manager for your Apple Wallet signing certificates.
    *   Add placeholder certificates to Google Secret Manager if they are empty.

2.  **Configure GitHub Secrets:**

    After running `make setup`, display the required GitHub Actions secrets:

    ```bash
    make show-github-secrets
    ```

    Add these secrets to your GitHub repository under `Settings > Secrets and variables > Actions`.

3.  **Upload Apple Wallet Signing Certificates:**

    You will need your actual Apple Wallet signing key (`.key`), certificate (`.pem`), and the Apple Worldwide Developer Relations Certification Authority (WWDR) certificate (`.pem`). Upload these to Google Secret Manager:

    ```bash
    make upload-signer-key
    make upload-signer-cert
    make upload-wwdr-cert
    ```

    Follow the prompts to provide the local file paths for each certificate.

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

### CI/CD Pipeline (GitHub Actions)

The project includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automates the deployment of the frontend to GitHub Pages and the backend to Google Cloud Run whenever changes are pushed to the `main` branch.

**Workflow Steps:**

*   **Checkout code:** Retrieves the latest code from the repository.
*   **Setup Node.js:** Configures the Node.js environment.
*   **Install dependencies:** Installs frontend and backend dependencies.
*   **Build frontend:** Builds the Vite frontend for production.
*   **Deploy frontend to GitHub Pages:** Uses `peaceiris/actions-gh-pages` to deploy the `dist` folder.
*   **Authenticate to GCP:** Uses Workload Identity Federation to authenticate with your GCP project.
*   **Build and Deploy backend to Cloud Run:** Builds the TypeScript backend and deploys it as a Docker image to Google Cloud Run.

**To trigger the CI/CD pipeline:**

Simply push your changes to the `main` branch:

```bash
git add .
git commit -m "feat: My new feature"
git push origin main
```

Monitor the progress of the deployment in the "Actions" tab of your GitHub repository.

## Makefile Reference

Here's a quick reference for common `make` commands:

*   `make help`: Displays all available Makefile targets and their descriptions.
*   `make setup`: Performs initial GCP project setup.
*   `make add-secrets-local`: Generates local placeholder certificates for development.
*   `make terraform-apply`: Deploys infrastructure via Terraform.
*   `make terraform-destroy`: Destroys all managed infrastructure.
*   `make show-github-secrets`: Displays GitHub Actions secrets to be configured.
*   `make upload-signer-key`: Uploads your Apple Wallet signer key to Secret Manager.
*   `make upload-signer-cert`: Uploads your Apple Wallet signer certificate to Secret Manager.
*   `make upload-wwdr-cert`: Uploads your Apple WWDR certificate to Secret Manager.
*   `make map-custom-domain`: Maps a custom domain to the Cloud Run service.
*   `make check-domain-status`: Checks the status of the custom domain mapping.
