const axios = require('axios');
const axiosRetry = require('axios-retry');
const { Logger } = require('channelape-logger');
const { LogLevel } = require('channelape-sdk');
const LOGGER = new Logger('asanaService', LogLevel.INFO);

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
        .catch(reason => LOGGER.error(reason && reason.message));
};

module.exports.getTasksByProject = (projectId, offset) => {
    if (offset === undefined) {
        offset = null;
    }
    return instance
        .get(`/tasks`, {
            params: {
                project: projectId,
                offset: offset,
                limit: 50
            },
        })
        .then(response => response && response.data)
        .catch(reason => LOGGER.error(reason && reason.message));
};

module.exports.deleteTaskById = (id) => {
    return instance
        .delete(`/tasks/${id}`)
        .then(response => response && response.data && response.data.data)
        .catch(reason => LOGGER.error(reason && reason.message));
};

module.exports.getUserById = (id) => {
    return instance
        .get(`/users/${id}`)
        .then(response => response && response.data && response.data.data)
        .catch(reason => LOGGER.error(reason && reason.message));
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
        .catch(reason => LOGGER.error(reason && reason.message));
};

module.exports.getProjectById = (id) => {
    return instance
        .get(`/projects/${id}`)
        .then(response => response && response.data && response.data.data)
        .catch(reason => LOGGER.error(reason && reason.message));
};


module.exports.getProjectMembershipById = (id) => {
    return instance
        .get(`/project_memberships/${id}`)
        .then(response => response && response.data && response.data.data)
        .catch(reason => LOGGER.error(reason && reason.message));
};


module.exports.getSectionsByProject = (projectId) => {
    return instance
        .get(`/projects/${projectId}/sections`, {
            params: {
                workspace: `${process.env.ASANA_WORKSPACE}`,
            },
        })
        .then(response => response && response.data && response.data.data)
        .catch(reason => LOGGER.error(reason && reason.message));
}

module.exports.createSectionOnProject = (projectId, sectionName) => {
    return instance
        .post(`/projects/${projectId}/sections`, {
            data: {
                name: sectionName,
            },
        })
        .then(() => LOGGER.info(`Section ${sectionName} created on projectId: ${projectId}`))
        .catch(reason => LOGGER.error(`Error ${sectionName} NOT created on projectId: ${projectId}: ${reason && reason.message}`));
}


module.exports.addProjectOnSubtask = (subtask, parentTask) => {

    const taskId = subtask.gid;
    const taskName = subtask.name;
    const projectId = parentTask.memberships[0].project.gid;
    const projectName = parentTask.memberships[0].project.name;
    const ignoredSubtaskProjects = process.env.IGNORED_SUBTASK_PROJECTS_LIST.split(',');

    if(projectName.startsWith("T: ") || (ignoredSubtaskProjects.indexOf(projectId) > -1)){
        LOGGER.info(`This is a template or ignored project environment variable. We won't add ${projectName} on subtask ${taskName}`);
    }else{
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
                .then(() => LOGGER.info(`Task ${taskId} was successfully moved to ${projectName} ${sectionName} section`))
                .catch(reason => LOGGER.error(`Error occur during moving task ${taskId} to ${projectName} ${sectionName} section: ${reason && reason.message}`));
        })
    }
}



module.exports.aggregateProjects = (offset) => {
    this.getAllProjects('false', offset).then(page => { 
        this.subscribeProjectsToWebhooks(page.data);
        if(page.next_page){
            this.aggregateProjects(page.next_page.offset);
        }else{
            LOGGER.info('Done retrieving all projects');
        }
    });
}

module.exports.deleteAllTasksInProject = (projectId, offset) => {
    this.getTasksByProject(projectId, offset).then(page => { 
        page.data.forEach(task => {
            let sleep = this.getRandomArbitrary(500,10000);
            this.sleep(sleep).then(() => {
                this.deleteTaskById(task.gid);
                LOGGER.info('Deleted ' + task.name);
              });
        })
        if(page.next_page){
            this.deleteAllTasksInProject(projectId, page.next_page.offset);
        }else{
            LOGGER.info(`Done retrieving all tasks for deletion for ${projectId}`);
        }
    });
}

module.exports.getRandomArbitrary = (min, max) => {
    return Math.random() * (max - min) + min;
  }

module.exports.sleep = (millis) =>{
    return new Promise(resolve => setTimeout(resolve, millis));
}

module.exports.subscribeProjectsToWebhooks = (page) => {
        page.forEach(project => {
            let name = project.name;
            if(name.startsWith("T: ")){
                LOGGER.info("This is a template, don't subscribe to webhooks");
                LOGGER.info(name); 
            }else{
                this.subscribeToTaskAddedWebhook(project.gid, project.name);
                this.subscribeToProjectMembershipWebhook(project.gid, project.name);
            }
            
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
        .then(() => LOGGER.info(`Webhooks for Project ${projectName}: ${projectId} were successfully subscribed`))
        .catch(reason => LOGGER.error(`Webhooks for Project ${projectName}: ${projectId} were errored during subscribe: ${reason && reason.message}`));
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
        .then(() => LOGGER.info(`Webhooks for Project: ${projectId} were successfully subscribed`))
        .catch(reason => LOGGER.error(`Webhooks for Project: ${projectId} were errored during subscribe: ${reason && reason.message}`));
}