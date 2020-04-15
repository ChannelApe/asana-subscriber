require('dotenv').config();

const fs = require('fs');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const { log } = require("./services/logger");
const { isSubTaskFiler } = require('./services/utils');
const { getTaskById, addProjectOnSubtask, subscribeToTaskAddedWebhook, createSectionOnProject, getUserById, getProjectMembershipById, getProjectById, subscribeToProjectMembershipWebhook } = require("./services/asana-service");
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
        log(`Received ${events.length} task-added webhook events`);
        events.map(event => {
            if(event.resource.resource_type === 'task' && event.action === 'added' && event.parent.resource_type === 'task'){
                getTaskById(event.resource.gid).then(task => {
                    if(task){
                        console.log('its a subtask with parent resource_type of task')
                        getTaskById(task.parent.gid).then(parentTask => {
                            addProjectOnSubtask(task, parentTask);
                        });
                    }
                })
            }else{
                console.log('its not a task or task with parent with resource_type of task')
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
        log(`Received ${events.length} project-added webhook events`);
        events.map(event => {
            if(event.action === 'added' && event.resource.resource_type === 'project' && event.parent.resource_type === 'workspace'){
                const projectId = event.resource.gid;
                subscribeToTaskAddedWebhook(projectId);
                subscribeToProjectMembershipWebhook(projectId);
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
        log(`Received ${events.length} project-membership webhook event(s)`);
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

app.listen(process.env.PORT, () => log(`Webhook Asana Subscriber listening on port ${process.env.PORT}!`));
