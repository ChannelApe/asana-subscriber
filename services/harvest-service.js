const axios = require('axios');
const { log, error } = require("./logger");


const harvestApi = axios.create({
    baseURL: 'https://api.harvestapp.com/api/v2/',
    headers: {
        'Authorization': `Bearer ${process.env.HARVEST_BEARER_TOKEN}`,
        'Harvest-Account-Id': `${process.env.HARVEST_ACCOUNT_ID}`,
        'User-Agent': `${process.env.HARVEST_APP}`
    }
});


module.exports.getAllUsers = async (active) => {
    if (active !== undefined) {
        active = 'true';
    }
    return await harvestApi
        .get(`/users?is_active=${active}`)
        .then(response => response && response.data)
        .catch(reason => reason && reason.message);
};

module.exports.getAllProjects = async (page) => {
    if (page !== undefined) {
        page = '1';
    }
    return await harvestApi
        .get(`/projects?page=${page}&is_active=true`)
        .then(response => response && response.data)
        .catch(reason => reason && reason.message);
};


module.exports.getUserById = async (id) => {
    return await harvestApi
        .get(`/users/${id}`)
        .then(response => response && response.data && response.data.data)
        .catch(reason => reason && reason.message);
};


module.exports.createUserAssignment = (projectId, userId) => {
    return harvestApi
        .post(`/projects/${projectId}/user_assignments?user_id=${userId}&use_default_rates=true`)
        .then(() => log(`User ${userId} added on projectId: ${projectId}`))
        .catch(reason => error(`Error ${userId} NOT added on projectId: ${projectId}: ${reason && reason.message}`));
}

module.exports.addEmailToHarvestProject = async (email, projectName) => {
    this.getAllUsers('true').then(list => {
        this.getAllProjects('1').then(response => {
            for (let index = 0; index < response.total_pages; index++) {
                this.getAllProjects(index).then(page => {
                    let projects = page.projects;
                    let projectMatched = 0;
                    for (let project of projects) {
                        if (project.name === projectName) {
                            log(`Found ${projectName} with ID of ${project.id}`);
                            let users = list.users;
                            let emailMatched = 0;
                            for (let user of users) {
                                if (user.email === email) {
                                    log(`${email} found with Harvest ID of: ${user.id}`)
                                    this.createUserAssignment(project.id, user.id);
                                    emailMatched = 1;
                                    break;
                                }
                            }
                            if (!emailMatched) {
                                log(`No active Harvest user match for ${email}`);
                            }
                            projectMatched = 1;
                            break;
                        }
                    }
                    if (!projectMatched) {
                        log(`No match for project ${projectName}`);
                    }
                })
            }
        })
    })
}
