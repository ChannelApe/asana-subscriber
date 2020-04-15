const axios = require('axios');
const axiosRetry = require('axios-retry');
const { debug, info, error } = require("./logger");


const harvestApi = axios.create({
    baseURL: 'https://api.harvestapp.com/api/v2/',
    headers: {
        'Authorization': `Bearer ${process.env.HARVEST_BEARER_TOKEN}`,
        'Harvest-Account-Id': `${process.env.HARVEST_ACCOUNT_ID}`,
        'User-Agent': `${process.env.HARVEST_APP}`
    }
});
axiosRetry(harvestApi, { retries: 5, retryDelay: axiosRetry.exponentialDelay });

module.exports.getAllUsers = async (active) => {
    if (active === undefined) {
        active = 'true';
    }
    return await harvestApi
        .get(`/users?is_active=${active}`)
        .then(response => response && response.data)
        .catch(reason => error(reason && reason.message));
};

module.exports.getAllProjects = async (page) => {
    if (page === undefined) {
        page = 1;
    }
    return await harvestApi
        .get(`/projects?page=${page}&is_active=true`)
        .then(response => response && response.data)
        .catch(reason => error(reason && reason.message));
};


module.exports.getUserById = async (id) => {
    return await harvestApi
        .get(`/users/${id}`)
        .then(response => response && response.data && response.data.data)
        .catch(reason => error(reason && reason.message));
};


module.exports.createUserAssignment = (projectId, userId) => {
    return harvestApi
        .post(`/projects/${projectId}/user_assignments?user_id=${userId}&use_default_rates=true`)
        .then(() => info(`Harvest User: ${userId} added on Harvest Project Id: ${projectId}`))
        .catch(reason => error(`Error Harvest User: ${userId} NOT added on Project Id: ${projectId}: ${reason && reason.message}`));
}

module.exports.addEmailToHarvestProject = async (email, projectName) => {
    this.getAllUsers('true').then(list => {
        this.getAllProjects(1).then(response => {
            for (let index = 1; index <= response.total_pages; index++) {
                this.getAllProjects(index).then(page => {
                        let projects = page.projects;
                        let projectMatched = 0;
                        for (let project of projects) {
                            if (project.name === projectName) {
                                info(`Found Harvest Project: ${projectName} with ID of ${project.id}`);
                                let users = list.users;
                                let emailMatched = 0;
                                for (let user of users) {
                                    if (user.email === email) {
                                        info(`Harvest user ${email} found with Harvest ID of: ${user.id}`)
                                        this.createUserAssignment(project.id, user.id);
                                        emailMatched = 1;
                                        break;
                                    }
                                }
                                if (!emailMatched) {
                                    logger.warn(`No active Harvest user match for ${email}`);
                                }
                                projectMatched = 1;
                                break;
                            }
                        }
                        if (!projectMatched) {
                            logger.warn(`No match for Harvest project ${projectName}`);
                        }
                    
                })
            }
        })
    })
}
