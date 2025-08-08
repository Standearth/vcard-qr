# QR Code Generator

A web-based QR Code and vCard generator for Stand.earth.

## Features

*   **vCard QR Code Generation:** Create QR codes that contain vCard contact information.
*   **Apple Wallet Pass Generation:** Generate Apple Wallet passes from vCard data.
*   **Customizable QR Codes:** Adjust the appearance of the QR codes.
*   **Real-time Preview:** See a live preview of the QR code as you type.

## Technologies Used

*   **Frontend:**
    *   HTML5
    *   SCSS
    *   TypeScript
    *   Vite
    *   [qr-code-styling](https://github.com/kozakdenys/qr-code-styling#readme)
*   **Backend:**
    *   Node.js
    *   Express.js
    *   TypeScript
*   **Deployment & Infrastructure:**
    *   GitHub Actions (CI/CD)
    *   Terraform (Infrastructure as Code)
    *   Google Cloud Platform (GCP)
        *   Cloud Run
        *   Secret Manager
    *   GitHub Pages

## Installation and Development

This project uses a `Makefile` to streamline various development and deployment tasks. Below are the instructions for setting up your local environment and deploying the application.

### Prerequisites

- [Node.js](https://nodejs.org/en/download/) (LTS version recommended)
- [npm](https://www.npmjs.com/get-npm) (comes with Node.js)
- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (for deployment to GCP)
- [Terraform](https://www.terraform.io/downloads.html) (for infrastructure provisioning)
- [OpenSSL](https://www.openssl.org/source/) (for generating local certificates)
- `rsvg-convert` (for converting SVG to PNG for Apple Wallet logos, install via `brew install librsvg` on macOS)

### Local Development Setup

1.  **Clone the repository:**

    ```bash
    git clone [https://github.com/Standearth/vcard-qr.git](https://github.com/Standearth/vcard-qr.git)
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
    make upload-signer-key path/to/Stand-PassKit.key
    make upload-signer-cert path/to/Stand-PassKit.pem
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
- **`make terraform-apply`**: Deploys infrastructure via Terraform.
- **`make terraform-destroy`**: Destroys all managed infrastructure.
- **`make show-github-secrets`**: Displays GitHub Actions secrets to be configured.
- **`make upload-signer-key [path/to/key]`**: Uploads your Apple Wallet signer key to Secret Manager.
- **`make upload-signer-cert [path/to/cert]`**: Uploads your Apple Wallet signer certificate to Secret Manager.
- **`make upload-wwdr-cert [path/to/wwdr]`**: Uploads your Apple WWDR certificate to Secret Manager.
- **`make map-custom-domain`**: Maps a custom domain to the Cloud Run service.
- **`make check-domain-status`**: Checks the status of the custom domain mapping.
