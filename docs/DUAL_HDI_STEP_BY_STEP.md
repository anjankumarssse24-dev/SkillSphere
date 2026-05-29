# Single App HDI Switch Runbook (One Space)

This runbook describes a single-app deployment model where only the HDI container changes.

- Test mode binds app to HDI container: `skillsphere-db`
- Prod mode binds app to HDI container: `skillsphere-db-prod`
- All other services remain the same (prod service instances)

## Scope

You deploy one MTA app instance and switch its DB binding by choosing extension file:

1. `mta.test.mtaext` -> binds `skillsphere-db`
2. `mta.prod.mtaext` -> binds `skillsphere-db-prod`

This runbook focuses on the repeatable DB switch process for daily operations.

Important:

1. Do not use `--namespace test` or `--namespace prod` in this model.
2. Namespace creates separate MTA identities, which is not single-app behavior.

## Prerequisites

1. Cloud Foundry CLI is installed.
2. MultiApps plugin is installed (`cf deploy` available).
3. MBT is installed (`mbt` available).
4. You have `SpaceDeveloper` role in target space.
5. Both HDI containers exist or can be created by your deployment rights.

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

## Step 2 - Confirm HDI Containers

```powershell
cf services
```

Verify:

1. `skillsphere-db` exists
2. `skillsphere-db-prod` exists (or will be created on first prod deploy)

## Step 3 - Build MTAR

You can build once and reuse the same artifact for both switches.

```powershell
mbt build -p cf -t mta_archives
```

Expected artifact:

`mta_archives/skillsphere_1.0.0.mtar`

## Step 4 - Switch to Test HDI Container (Repeatable)

Deploy same app using test extension (no namespace):

```powershell
cf deploy mta_archives/skillsphere_1.0.0.mtar -e mta.test.mtaext -f --retries 0
cf env skillsphere-srv
```

Expected:

1. Existing app is updated (not duplicated).
2. App binds to `skillsphere-db`.

## Step 5 - Switch to Prod HDI Container (Repeatable)

Deploy same app using prod extension (no namespace):

```powershell
cf deploy mta_archives/skillsphere_1.0.0.mtar -e mta.prod.mtaext -f --retries 0
cf env skillsphere-srv
```

Expected:

1. Same app is updated in place.
2. App binds to `skillsphere-db-prod`.

## Step 6 - Post-Switch Verification Checklist

```powershell
cf services
cf apps
cf mtas
cf env skillsphere-srv
```

Verify each time:

1. App name remains `skillsphere-srv` (single app identity)
2. `VCAP_SERVICES` shows expected HDI (`skillsphere-db` or `skillsphere-db-prod`)

## Step 7 - Rollback

Switch back to the other DB by redeploying with the other extension file:

```powershell
cf deploy mta_archives/skillsphere_1.0.0.mtar -e mta.test.mtaext -f --retries 0
```

or

```powershell
cf deploy mta_archives/skillsphere_1.0.0.mtar -e mta.prod.mtaext -f --retries 0
```

## Operational Notes

1. This is one running app identity, not two parallel landscapes.
2. Switching HDI rebinding affects the live app.
3. Plan the switch in a maintenance window if needed.
4. Do not run test dummy-data loads after switching to prod HDI.
5. Do not use `--namespace` flags in this model.

## Security Note

One-space setup gives technical data isolation by HDI container, but not strict admin isolation.
Anyone with `SpaceDeveloper` in the same space can inspect CF resources.
For stronger confidentiality/compliance, use separate spaces or separate subaccounts.
