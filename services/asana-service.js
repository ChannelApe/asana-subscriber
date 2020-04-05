const axios = require('axios');
const { log, error } = require("./logger");
const { projects: cachedProjects } = require('./cache-service');

const instance = axios.create({
    baseURL: 'https://app.asana.com/api/1.0/',
    headers: {
        Authorization: `Bearer ${process.env.ASANA_BEARER_TOKEN}`,
    }
});

instance.defaults.headers.post[ 'Content-Type' ] = 'application/json';

module.exports.getTaskById = (id) => {
    return instance
        .get(`/tasks/${id}`, {
            params: {
                workspace: `${process.env.ASANA_WORKSPACE}`,
            },
        })
        .then(response => response && response.data && response.data.data)
        .catch(reason => reason && reason.message);
};


module.exports.getSectionsByProject = (projectId) => {
    return instance
        .get(`/projects/${projectId}/sections`, {
            params: {
                workspace: `${process.env.ASANA_WORKSPACE}`,
            },
        })
        .then(response => response && response.data && response.data.data)
        .catch(reason => reason && reason.message);
}

module.exports.createSectionOnProject = (projectId, sectionName) => {
    return instance
        .post(`/projects/${projectId}/sections`, {
            data: {
                name: sectionName,
            },
        })
        .then(() => log(`Section ${sectionName} created on projectId: ${projectId}`))
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
            .then(() => log(`Task ${taskId} was successfully moved to ${projectName} ${sectionName} section`))
            .catch(reason => error(`Error occur during moving task ${taskId} to ${projectName} ${sectionName} section: ${reason && reason.message}`));
    })
}



module.exports.subscribeToTaskAddedWebhook = (projectId) => {

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
        .then(() => log(`Webhooks for Project: ${projectId} were successfully subscribed`))
        .catch(reason => error(`Webhooks for Project: ${projectId} were errored during subscribe: ${reason && reason.message}`));
}