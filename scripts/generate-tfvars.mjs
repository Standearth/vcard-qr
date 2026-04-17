// scripts/generate-tfvars.mjs
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const tfvarsPath = 'terraform.tfvars';

// Helper to read a JSON file and return it as a minified string
function getMinifiedJson(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    return JSON.stringify(JSON.parse(fileContent));
  } catch (error) {
    console.error(`Error reading or parsing ${filePath}:`, error.message);
    process.exit(1);
  }
}

// Helper to parse a JSON string from the .env file
function getParsedEnvJson(envVar, varName) {
  if (!envVar) {
    console.error(
      `Error: Environment variable ${varName} is missing from .env file.`
    );
    process.exit(1);
  }
  try {
    let cleanString = envVar;
    // Only remove outer single quotes if they actually survived the dotenv parsing
    if (cleanString.startsWith("'") && cleanString.endsWith("'")) {
      cleanString = cleanString.slice(1, -1);
    }
    return JSON.stringify(JSON.parse(cleanString));
  } catch (error) {
    console.error(`Error parsing JSON from ${varName}:`, error.message);
    process.exit(1);
  }
}

// Preserve the existing gcp_project_id if the file exists
let projectIdLine = '';
if (fs.existsSync(tfvarsPath)) {
  const tfvarsContent = fs.readFileSync(tfvarsPath, 'utf-8');
  const match = tfvarsContent.match(/gcp_project_id\s*=\s*"[^"]+"/);
  if (match) {
    projectIdLine = match[0];
  }
}

// Construct the new content for terraform.tfvars
// scripts/generate-tfvars.mjs
const newTfvarsContent = `
${projectIdLine}
frontend_domain = "${process.env.FRONTEND_DOMAIN}"
backend_domain = "${process.env.BACKEND_DOMAIN}"
api_domain = "${process.env.API_DOMAIN}"
vite_org_name = "${process.env.VITE_ORG_NAME}"
google_issuer_id = "${process.env.GOOGLE_ISSUER_ID}"

photo_service_url = <<EOT
${getParsedEnvJson(process.env.PHOTO_SERVICE_URL, 'PHOTO_SERVICE_URL')}
EOT

pass_config = <<EOT
${getMinifiedJson('server/src/config/pass-templates.json')}
EOT

pass_google_config = <<EOT
${getMinifiedJson('server/src/config/google-wallet-templates.json')}
EOT
`
  .trim()
  .replace(/^\s+/gm, ''); // Remove leading whitespace for clean formatting

fs.writeFileSync(tfvarsPath, newTfvarsContent + '\n'); // Add newline at the end

console.log('✅ terraform.tfvars has been updated successfully.');
