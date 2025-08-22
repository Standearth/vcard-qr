# --- Terraform Configuration ---
terraform {
  backend "gcs" {
    bucket = "" # This will be provided by the Makefile
    prefix = "terraform/state"
  }
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# --- Providers ---
provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

# --- Data Sources ---
data "google_project" "project" {}

# This tells Terraform about the service account created by the Makefile.
data "google_service_account" "github_runner_sa" {
  account_id = "github-actions-runner"
  project    = var.gcp_project_id
}

# This gets the default service account that Cloud Run will use at runtime.
data "google_compute_default_service_account" "default" {
  project = var.gcp_project_id
}

# --- Variables ---
variable "gcp_project_id" {
  type        = string
  description = "The GCP project ID."
}

variable "gcp_region" {
  type        = string
  description = "The GCP region for resources."
  default     = "us-central1"
}

variable "service_name" {
  type        = string
  description = "The name of the Cloud Run service."
  default     = "pkpass-server"
}

variable "frontend_domain" {
  type        = string
  description = "The production domain for the frontend."
}
variable "vite_org_name" {
  type        = string
  description = "The name of the organization (from VITE_ORG_NAME)."
}
variable "pass_config" {
  type        = string
  description = "The pkpass configuration (json)."
}

variable "photo_service_url" {
  type        = string
  description = "The base URL for the photo lookup service."
}

# --- Resources ---

# Enable all necessary APIs
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com"
  ])
  service            = each.key
  disable_on_destroy = false
}

# Artifact Registry to store the Docker image
resource "google_artifact_registry_repository" "docker_repo" {
  project       = var.gcp_project_id
  location      = var.gcp_region
  repository_id = "${var.service_name}-repo"
  description   = "Docker repository for the ${var.service_name}"
  format        = "DOCKER"
  depends_on    = [google_project_service.apis]
  cleanup_policies {
    id     = "delete-untagged-images-after-7-days"
    action = "DELETE"
    condition {
      tag_state  = "UNTAGGED"
      older_than = "604800s" # 7 days in seconds
    }
  }
}

# Cloud Run Service
resource "google_cloud_run_v2_service" "default" {
  name     = var.service_name
  location = var.gcp_region
  project  = var.gcp_project_id

  template {
    containers {
      image = "${var.gcp_region}-docker.pkg.dev/${var.gcp_project_id}/${google_artifact_registry_repository.docker_repo.repository_id}/${var.service_name}:latest"
      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "FRONTEND_DOMAIN"
        value = var.frontend_domain
      }
      env {
        name  = "VITE_ORG_NAME"
        value = var.vite_org_name
      }
      env {
        name  = "PASS_CONFIG"
        value = var.pass_config
      }
      env {
        name  = "SIGNER_KEY_SECRET"
        value = "projects/${var.gcp_project_id}/secrets/apple-wallet-signer-key/versions/latest"
      }
      env {
        name  = "SIGNER_CERT_SECRET"
        value = "projects/${var.gcp_project_id}/secrets/apple-wallet-signer-cert/versions/latest"
      }
      env {
        name  = "WWDR_CERT_SECRET"
        value = "projects/${var.gcp_project_id}/secrets/apple-wallet-wwdr-cert/versions/latest"
      }
      env {
        name  = "PHOTO_SERVICE_URL"
        value = var.photo_service_url
      }
    }
  }

  depends_on = [google_project_service.apis]
}

# Allow public, unauthenticated access to the Cloud Run service
resource "google_cloud_run_service_iam_member" "public_access" {
  location = google_cloud_run_v2_service.default.location
  project  = google_cloud_run_v2_service.default.project
  service  = google_cloud_run_v2_service.default.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# --- Permissions for the Cloud Run Service Account ---
# This allows the running service to access its required secrets.
resource "google_secret_manager_secret_iam_member" "secret_access" {
  for_each = toset([
    "apple-wallet-signer-key",
    "apple-wallet-signer-cert",
    "apple-wallet-wwdr-cert"
  ])
  project    = var.gcp_project_id
  secret_id  = each.key
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${data.google_compute_default_service_account.default.email}"
  depends_on = [google_project_service.apis]
}

# --- Permissions for the GitHub Actions CI/CD ---

# 1. Grant the GitHub Actions SA permission to push images to Artifact Registry.
resource "google_artifact_registry_repository_iam_member" "writer" {
  project    = google_artifact_registry_repository.docker_repo.project
  location   = google_artifact_registry_repository.docker_repo.location
  repository = google_artifact_registry_repository.docker_repo.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${data.google_service_account.github_runner_sa.email}"
}

# 2. Grant the GitHub Actions SA permission to deploy to the Cloud Run service.
resource "google_cloud_run_v2_service_iam_member" "deployer" {
  project  = google_cloud_run_v2_service.default.project
  location = google_cloud_run_v2_service.default.location
  name     = google_cloud_run_v2_service.default.name
  role     = "roles/run.admin"
  member   = "serviceAccount:${data.google_service_account.github_runner_sa.email}"
}

# 3. Grant the GitHub Actions SA permission to act as the Cloud Run service's runtime account.
resource "google_service_account_iam_member" "service_account_user" {
  service_account_id = data.google_compute_default_service_account.default.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${data.google_service_account.github_runner_sa.email}"
}

# --- Output ---
output "service_url" {
  description = "The URL of the deployed Cloud Run service."
  value       = google_cloud_run_v2_service.default.uri
}
