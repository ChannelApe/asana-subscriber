require('dotenv').config();

const fs = require('fs');
const express = require('express');
const app = express();
const schedule = require('node-schedule');
const bodyParser = require('body-parser');
const log4js = require('log4js');
log4js.configure({
    appenders: { console: { type: 'console' } },
    categories: { default: { appenders: [ 'console' ], level: 'info' } }
  });
const logger = log4js.getLogger('Asana-Subscriber');
const { getTaskById, addProjectOnSubtask, subscribeToTaskAddedWebhook, createSectionOnProject, getUserById, getProjectMembershipById, getProjectById, subscribeToProjectMembershipWebhook, aggregateProjects } = require("./services/asana-service");
const { addEmailToHarvestProject } = require("./services/harvest-service");
const { isEstablishingWebHookProcess, handleHandShake } = require('./services/webhook-service');

/* Application */
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

app.post('/receive-webhook/task-added', (req, res) => {
    if (isEstablishingWebHookProcess(req)) {
        return handleHandShake(req, res);
    }

    const events = req.body && req.body.events;
    if (events) {
        logger.info(`Received ${events.length} task-added webhook events`);
        events.map(event => {
            if(event.resource.resource_type === 'task' && event.action === 'added' && event.parent.resource_type === 'task'){
                getTaskById(event.resource.gid).then(task => {
                    if(task){
                        console.logger.info('its a subtask with parent resource_type of task')
                        getTaskById(task.parent.gid).then(parentTask => {
                            addProjectOnSubtask(task, parentTask);
                        });
                    }
                })
            }else{
                logger.debug('its not a task or task with parent with resource_type of task')
            }
        });
        
    }

    res.sendStatus(200);
});

app.post('/receive-webhook/project-added', (req, res) => {
    if (isEstablishingWebHookProcess(req)) {
        return handleHandShake(req, res);
    }

    const events = req.body && req.body.events;
    if (events) {
        logger.info(`Received ${events.length} project-added webhook events`);
        events.map(event => {
            if(event.action === 'added' && event.resource.resource_type === 'project' && event.parent.resource_type === 'workspace'){
                const projectId = event.resource.gid;
                subscribeToTaskAddedWebhook(projectId, event.resource.name);
                subscribeToProjectMembershipWebhook(projectId, event.resource.name);
                createSectionOnProject(projectId, 'Subtasks');
            }
        });
        
    }

    res.sendStatus(200);
});


app.post('/receive-webhook/project-membership', (req, res) => {
    if (isEstablishingWebHookProcess(req)) {
        return handleHandShake(req, res);
    }

    const events = req.body && req.body.events;
    if (events) {
        logger.info(`Received ${events.length} project-membership webhook event(s)`);
        events.map(event => {
            if(event.action === 'added' && event.resource.resource_type === 'project_membership'){
                const projectMembershipId = event.resource.gid;
                getProjectMembershipById(projectMembershipId).then(projectMembership => {
                    const uid = projectMembership.user.gid;
                    getUserById(uid).then(user => {
                        getProjectById(event.parent.gid).then(project => {
                            addEmailToHarvestProject(user.email, project.name);
                        });
                    });
                });
            }
        });
        
    }

    res.sendStatus(200);
});

app.listen(process.env.PORT, () => logger.info(`Webhook Asana Subscriber listening on port ${process.env.PORT}!`));
schedule.scheduleJob('12 23 * * *', function(){
    logger.info('Running webhook daily scheduler to fix missing webhooks');
    aggregateProjects();
});