const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '..', 'webapp', 'manifest.json');
const variant = String(process.env.UI_VARIANT || 'test').trim().toLowerCase();

const variants = {
  test: {
    appId: 'skillsphere.test',
    cloudService: 'skillsphere-test'
  },
  prod: {
    appId: 'skillsphere.prod',
    cloudService: 'skillsphere-prod'
  }
};

const config = variants[variant];
if (!config) {
  console.error(`Unsupported UI_VARIANT: ${variant}. Use one of: ${Object.keys(variants).join(', ')}`);
  process.exit(1);
}

const raw = fs.readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(raw);

manifest['sap.app'] = manifest['sap.app'] || {};
manifest['sap.cloud'] = manifest['sap.cloud'] || {};
manifest['sap.app'].id = config.appId;
manifest['sap.cloud'].service = config.cloudService;

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(`Applied UI variant '${variant}': id=${config.appId}, service=${config.cloudService}`);
