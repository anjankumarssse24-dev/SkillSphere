const cds = require('@sap/cds');

const employeeId = 'I770144';

let GET;
let POST;
let PATCH;
let DELETE;

function keyPath(entitySet, keyName, keyValue) {
  return `/${entitySet}(${keyName}=guid'${keyValue}')`;
}

async function createReadUpdateDelete({
  label,
  entitySet,
  keyName,
  payload,
  updatePayload,
  verifyUpdated
}) {
  const result = {
    label,
    created: false,
    visibleAfterCreate: false,
    updated: false,
    visibleAfterUpdate: false,
    deleted: false,
    hiddenAfterDelete: false
  };

  const createdRecord = await POST(`/odata/v4/skillsphere/${entitySet}`, payload);
  const keyValue = createdRecord[keyName];

  if (!keyValue) {
    throw new Error(`${label}: create response did not include ${keyName}`);
  }

  result.created = true;

  const readAfterCreate = await GET(`/odata/v4/skillsphere${keyPath(entitySet, keyName, keyValue)}`);
  result.visibleAfterCreate = !!readAfterCreate?.[keyName];

  await PATCH(`/odata/v4/skillsphere${keyPath(entitySet, keyName, keyValue)}`, updatePayload);
  result.updated = true;

  const readAfterUpdate = await GET(`/odata/v4/skillsphere${keyPath(entitySet, keyName, keyValue)}`);
  result.visibleAfterUpdate = verifyUpdated(readAfterUpdate);

  await DELETE(`/odata/v4/skillsphere${keyPath(entitySet, keyName, keyValue)}`);
  result.deleted = true;

  try {
    await GET(`/odata/v4/skillsphere${keyPath(entitySet, keyName, keyValue)}`);
    result.hiddenAfterDelete = false;
  } catch (error) {
    if (error.status === 404 || error.code === 404) {
      result.hiddenAfterDelete = true;
    } else {
      throw error;
    }
  }

  return result;
}

async function main() {
  ({ GET, POST, PATCH, DELETE } = cds.test('c:/Users/I774156/skillsphere_CF'));

  const tests = [
    {
      label: 'Add skill',
      entitySet: 'Skills',
      keyName: 'skillId',
      payload: {
        employeeId,
        skillName: 'UUID Smoke Skill',
        category: 'Testing',
        proficiencyLevel: 'Beginner',
        yearsExperience: 1,
        certificationStatus: 'None'
      },
      updatePayload: {
        proficiencyLevel: 'Intermediate',
        yearsExperience: 2
      },
      verifyUpdated: record => record.proficiencyLevel === 'Intermediate' && Number(record.yearsExperience) === 2
    },
    {
      label: 'Add project',
      entitySet: 'Projects',
      keyName: 'projectId',
      payload: {
        employeeId,
        projectName: 'UUID Smoke Project',
        role: 'Developer',
        startDate: '2026-04-17',
        endDate: '2026-05-17',
        status: 'Active',
        description: 'Smoke test project',
        duration: '1 month',
        projectManager: 'Smoke Manager',
        technology: 'Testing'
      },
      updatePayload: {
        role: 'Lead Developer',
        description: 'Updated smoke test project'
      },
      verifyUpdated: record => record.role === 'Lead Developer' && record.description === 'Updated smoke test project'
    },
    {
      label: 'Assign project',
      entitySet: 'CurrentProjects',
      keyName: 'currentProjectId',
      payload: {
        employeeId,
        type: 'Project',
        projectName: 'UUID Smoke Assignment',
        role: 'Team Member',
        projectManager: 'Smoke Manager',
        startDate: '2026-04-17',
        endDate: '2026-05-17',
        utilizationPercent: 75,
        description: 'Smoke assignment',
        assignmentStatus: 'Accepted',
        isEvaluation: false,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      },
      updatePayload: {
        utilizationPercent: 50,
        description: 'Updated smoke assignment',
        lastUpdated: new Date().toISOString()
      },
      verifyUpdated: record => Number(record.utilizationPercent) === 50 && record.description === 'Updated smoke assignment'
    },
    {
      label: 'Add initiative',
      entitySet: 'Initiatives',
      keyName: 'initiativeId',
      payload: {
        employeeId,
        initiativeName: 'UUID Smoke Initiative',
        description: 'Smoke initiative',
        startDate: '2026-04-17',
        endDate: '2026-06-17',
        utilizationPercent: 20,
        status: 'Active',
        type: 'Initiative',
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      },
      updatePayload: {
        description: 'Updated smoke initiative',
        utilizationPercent: 25,
        lastUpdated: new Date().toISOString()
      },
      verifyUpdated: record => record.description === 'Updated smoke initiative' && Number(record.utilizationPercent) === 25
    },
    {
      label: 'Add CAIA',
      entitySet: 'CAIAUtilization',
      keyName: 'caiaId',
      payload: {
        employeeId,
        taskName: 'UUID Smoke CAIA',
        startDate: '2026-04-17',
        endDate: '2026-04-30',
        hoursPerDay: 2,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      },
      updatePayload: {
        taskName: 'Updated UUID Smoke CAIA',
        hoursPerDay: 3,
        lastUpdated: new Date().toISOString()
      },
      verifyUpdated: record => record.taskName === 'Updated UUID Smoke CAIA' && Number(record.hoursPerDay) === 3
    },
    {
      label: 'Add POC',
      entitySet: 'POCUtilization',
      keyName: 'pocId',
      payload: {
        employeeId,
        pocTitle: 'UUID Smoke POC',
        startDate: '2026-04-17',
        endDate: '2026-05-01',
        hoursPerDay: 2,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      },
      updatePayload: {
        pocTitle: 'Updated UUID Smoke POC',
        hoursPerDay: 4,
        lastUpdated: new Date().toISOString()
      },
      verifyUpdated: record => record.pocTitle === 'Updated UUID Smoke POC' && Number(record.hoursPerDay) === 4
    },
    {
      label: 'Add certification',
      entitySet: 'Certifications',
      keyName: 'certificationId',
      payload: {
        employeeId,
        name: 'UUID Smoke Certification',
        code: 'UUID-SMOKE',
        dateOfCompletion: '2026-04-17',
        description: 'Smoke certification',
        level: 'Associate',
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      },
      updatePayload: {
        description: 'Updated smoke certification',
        level: 'Professional',
        lastUpdated: new Date().toISOString()
      },
      verifyUpdated: record => record.description === 'Updated smoke certification' && record.level === 'Professional'
    }
  ];

  const results = [];
  for (const test of tests) {
    results.push(await createReadUpdateDelete(test));
  }

  const failures = results.filter(result => Object.entries(result).some(([key, value]) => key !== 'label' && value !== true));

  console.log(JSON.stringify({ results, failures }, null, 2));

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  const message = error.response?.data || error.message || error;
  console.error(JSON.stringify({ fatal: message }, null, 2));
  process.exit(1);
});
