# Dual HDI Deployment Runbook (One Space)

This document is the exact process for your current target model:

- Test uses existing HDI container: `skillsphere-db`
- Prod uses new HDI container: `skillsphere-db-prod`

## Scope

You deploy the same MTAR twice with different extension files:

1. `mta.test.mtaext` -> test apps + existing test DB container
2. `mta.prod.mtaext` -> prod apps + new prod DB container

Important: deploy with different namespaces (`test` and `prod`).
If namespace is omitted, the second deployment updates the same MTA instance and can remove the first app (for example `skillsphere-srv-test` route no longer exists).

UI app identity is environment-specific:

1. Test HTML5 app ID: `skillsphere.test` (`sap.cloud.service: skillsphere-test`)
2. Prod HTML5 app ID: `skillsphere.prod` (`sap.cloud.service: skillsphere-prod`)

## Prerequisites

1. Cloud Foundry CLI is installed.
2. MultiApps plugin is installed (`cf deploy` command available).
3. MBT is installed (`mbt` command available).
4. You have `SpaceDeveloper` role in target space.
5. Required service quota/entitlements are available for one extra prod set.

Quick checks:

```powershell
cf --version
cf deploy -h
mbt --version
```

## Files Used

1. Base descriptor: `mta.yaml`
2. Test extension: `mta.test.mtaext`
3. Prod extension: `mta.prod.mtaext`

## Step 1 - Login and Target Correct Space

```powershell
cf login -a https://api.eu12.hana.ondemand.com
cf target -o <your-org> -s <your-space>
cf target
```

Confirm org/space in `cf target` output before deploying.

## Step 2 - Confirm Existing Test HDI Container Exists

```powershell
cf services
```

Ensure `skillsphere-db` is present before test deploy.

## Step 3 - Build Test MTAR

```powershell
npm install
$env:UI_VARIANT="test"
mbt build -p cf -t mta_archives_test
```

Expected artifact:

`mta_archives_test/skillsphere_1.0.0.mtar`

## Step 4 - Deploy Test Landscape (Existing HDI)

```powershell
cf deploy mta_archives_test/skillsphere_1.0.0.mtar -e mta.test.mtaext --namespace test -f --retries 0
```

Expected:

1. App `skillsphere-srv-test` is created/updated.
2. App is bound to `skillsphere-db`.
3. No new test HDI container is created.

## Step 5 - Test and Load Dummy Data (Test Only)

Run bug fixes and test data operations only in test deployment.

Never run dummy seeding against prod deployment.

## Step 6 - Build Prod MTAR

```powershell
$env:UI_VARIANT="prod"
mbt build -p cf -t mta_archives_prod
```

Expected artifact:

`mta_archives_prod/skillsphere_1.0.0.mtar`

## Step 7 - Deploy Prod Landscape (New HDI)

```powershell
cf deploy mta_archives_prod/skillsphere_1.0.0.mtar -e mta.prod.mtaext --namespace prod -f --retries 0
```

Expected:

1. Service `skillsphere-db-prod` is created (first time) or updated.
2. App `skillsphere-srv-prod` is created/updated.
3. Prod app is bound to `skillsphere-db-prod`.

## Step 8 - Verify Isolation

Run:

```powershell
cf services
cf apps
cf mtas
cf env skillsphere-srv-test
cf env skillsphere-srv-prod
```

What to verify in `cf env` output (`VCAP_SERVICES`):

1. `skillsphere-srv-test` references `skillsphere-db`
2. `skillsphere-srv-prod` references `skillsphere-db-prod`

If you get `App '<name>' not found`, that app has not been deployed yet in the currently targeted org/space.

## Step 8 - Recommended Release Discipline

1. Build test artifact with `UI_VARIANT=test` and deploy test.
2. Validate functionality and data.
3. Build prod artifact with `UI_VARIANT=prod` and deploy prod.
4. Keep prod seed/dummy data disabled.

## Security Note

One-space setup gives technical data isolation by HDI container, but not strict admin isolation.
Anyone with `SpaceDeveloper` in that same space can still inspect CF resources.
For stronger confidentiality/compliance, use separate spaces (or separate subaccounts) for test and prod.
