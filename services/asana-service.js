const axios = require('axios');
const axiosRetry = require('axios-retry');
const { debug, info, error } = require("./logger");

const instance = axios.create({
    baseURL: 'https://app.asana.com/api/1.0/',
    headers: {
        Authorization: `Bearer ${process.env.ASANA_BEARER_TOKEN}`,
    }
});
axiosRetry(instance, { retries: 5, retryDelay: axiosRetry.exponentialDelay });
instance.defaults.headers.post[ 'Content-Type' ] = 'application/json';

module.exports.getTaskById = (id) => {
    return instance
        .get(`/tasks/${id}`, {
            params: {
                workspace: `${process.env.ASANA_WORKSPACE}`,
            },
        })
        .then(response => response && response.data && response.data.data)
        .catch(reason => error(reason && reason.message));
};

module.exports.getUserById = (id) => {
    return instance
        .get(`/users/${id}`)
        .then(response => response && response.data && response.data.data)
        .catch(reason => error(reason && reason.message));
};

module.exports.getAllProjects = (archived, offset) => {
    path = `/projects`
    if (archived === undefined) {archived = 'false';}
    if (offset === undefined) {
        path = `/projects?archived=${archived}&limit=5&workspace=${process.env.ASANA_WORKSPACE}`
    }else{
        path = `/projects?archived=${archived}&limit=5&offset=${offset}&workspace=${process.env.ASANA_WORKSPACE}`
    }

    return instance
        .get(path)
        .then(response => response && response.data)
        .catch(reason => error(reason && reason.message));
};

module.exports.getProjectById = (id) => {
    return instance
        .get(`/projects/${id}`)
        .then(response => response && response.data && response.data.data)
        .catch(reason => error(reason && reason.message));
};


module.exports.getProjectMembershipById = (id) => {
    return instance
        .get(`/project_memberships/${id}`)
        .then(response => response && response.data && response.data.data)
        .catch(reason => error(reason && reason.message));
};


module.exports.getSectionsByProject = (projectId) => {
    return instance
        .get(`/projects/${projectId}/sections`, {
            params: {
                workspace: `${process.env.ASANA_WORKSPACE}`,
            },
        })
        .then(response => response && response.data && response.data.data)
        .catch(reason => error(reason && reason.message));
}

module.exports.createSectionOnProject = (projectId, sectionName) => {
    return instance
        .post(`/projects/${projectId}/sections`, {
            data: {
                name: sectionName,
            },
        })
        .then(() => info(`Section ${sectionName} created on projectId: ${projectId}`))
        .catch(reason => error(`Error ${sectionName} NOT created on projectId: ${projectId}: ${reason && reason.message}`));
}


module.exports.addProjectOnSubtask = (subtask, parentTask) => {

    const taskId = subtask.gid;
    const projectId = parentTask.memberships[0].project.gid;
    const projectName = parentTask.memberships[0].project.name;

    this.getSectionsByProject(projectId)
    .then(sections => {
        result = sections.find( ({ name }) => name === 'Subtasks');
        var sectionId = '';
        var sectionName = '';

        if(result){
            sectionId = result.gid;
            sectionName = result.name;
        }else{
            sectionCreateResult = this.createSectionOnProject(projectId, 'Subtasks');
            sectionId = sectionCreateResult.gid;
            sectionName = sectionCreateResult.name;
        }

        instance
            .post(`/tasks/${taskId}/addProject`, {
                data: {
                    task_gid: taskId,
                    project: projectId,
                    section: sectionId,
                },
            })
            .then(() => info(`Task ${taskId} was successfully moved to ${projectName} ${sectionName} section`))
            .catch(reason => error(`Error occur during moving task ${taskId} to ${projectName} ${sectionName} section: ${reason && reason.message}`));
    })
}



module.exports.aggregateProjects = (offset) => {
    this.getAllProjects('false', offset).then(page => { 
        this.subscribeProjectsToWebhooks(page.data);
        if(page.next_page){
            this.aggregateProjects(page.next_page.offset);
        }else{
            info('Done retrieving all projects');
        }
    });
}



module.exports.subscribeProjectsToWebhooks = (page) => {
        page.forEach(project => {
            this.subscribeToTaskAddedWebhook(project.gid, project.name);
            this.subscribeToProjectMembershipWebhook(project.gid, project.name);
        });
}

module.exports.subscribeToTaskAddedWebhook = (projectId, projectName) => {

    return instance
        .post(`/webhooks`, {
            data: {
                resource: projectId,
                target: `${process.env.CALLBACK_BASE_URL}/receive-webhook/task-added`,
                filters: [
                    {
                        resource_type: "task",
                        action: "added"
                    }
                ] 
            },
        })
        .then(() => info(`Webhooks for Project ${projectName}: ${projectId} were successfully subscribed`))
        .catch(reason => error(`Webhooks for Project ${projectName}: ${projectId} were errored during subscribe: ${reason && reason.message}`));
}

module.exports.subscribeToProjectMembershipWebhook = (projectId) => {

    return instance
        .post(`/webhooks`, {
            data: {
                resource: projectId,
                target: `${process.env.CALLBACK_BASE_URL}/receive-webhook/project-membership`,
                filters: [
                    {
                        resource_type: "project_membership"
                    }
                ] 
            },
        })
        .then(() => info(`Webhooks for Project: ${projectId} were successfully subscribed`))
        .catch(reason => error(`Webhooks for Project: ${projectId} were errored during subscribe: ${reason && reason.message}`));
}