const express = require('express')
const router = express.Router()
const indexModel = require('../model/indexModel')
router.post('/login', (req, res) => {
  indexModel.login(req, res)
})
router.post('/register', (req, res) => {
  indexModel.register(req, res)
})
router.get('/events/:user_id', (req, res) => {
  indexModel.findEventsByUserId(req, res)
})
router.post('/events/add', (req, res) => {
  indexModel.addEvents(req, res)
})
router.get('/events/:event_id/tasks', (req, res) => {
  indexModel.findTasksByEventId(req, res)
})
router.get('/tasks/:task_id', (req, res) => {
  indexModel.findTaskByTaskId(req, res)
})
router.post('/tasks/add', (req, res) => {
  indexModel.addTask(req, res)
})
router.post('/tasks/edit', (req, res) => {
  indexModel.editTask(req, res)
})
module.exports = router