const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '..', 'webapp', 'manifest.json');
const variant = String(process.env.UI_VARIANT || 'test').trim().toLowerCase();

// Single-app workflow: UI identity is fixed regardless of DB-switch extension file.
const config = {
  appId: 'skillsphere.prod',
  cloudService: 'skillsphere-prod',
  namespace: 'skillsphere'
};

if (!['test', 'prod'].includes(variant)) {
  console.error(`Unsupported UI_VARIANT: ${variant}. Use one of: test, prod`);
  process.exit(1);
}

const raw = fs.readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(raw);

// Update sap.app
manifest['sap.app'] = manifest['sap.app'] || {};
manifest['sap.app'].id = config.appId;

// Update sap.cloud
manifest['sap.cloud'] = manifest['sap.cloud'] || {};
manifest['sap.cloud'].service = config.cloudService;

// Update sap.ui5 namespace references
if (manifest['sap.ui5']) {
  // Update i18n model bundleName
  if (manifest['sap.ui5'].models && manifest['sap.ui5'].models.i18n) {
    manifest['sap.ui5'].models.i18n.settings = manifest['sap.ui5'].models.i18n.settings || {};
    manifest['sap.ui5'].models.i18n.settings.bundleName = `${config.namespace}.i18n.i18n`;
  }
  
  // Update routing config path
  if (manifest['sap.ui5'].routing && manifest['sap.ui5'].routing.config) {
    manifest['sap.ui5'].routing.config.path = `${config.namespace}.view`;
  }
  
  // Update rootView viewName
  if (manifest['sap.ui5'].rootView) {
    manifest['sap.ui5'].rootView.viewName = `${config.namespace}.view.App`;
  }
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(`Applied UI variant '${variant}':`);
if (variant === 'test') {
  console.log('  - Note: in single-app mode, test/prod UI identity is intentionally the same.');
}
console.log(`  - sap.app.id: ${config.appId}`);
console.log(`  - sap.cloud.service: ${config.cloudService}`);
console.log(`  - namespace: ${config.namespace}`);
