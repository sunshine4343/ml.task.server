const request = require('request')
const {
  userModel,
  eventModel,
  taskModel,
  logModel,
  versionModel,
  punchModel,
  countdownModel,
  configModel
} = require('../schema/indexSchema')
const { ApiResponse } = require('../utils/apiUtils')
const { formatYMD } = require('../utils/index')
const { AppID, AppSecret } = global.config

const insertLog = ({ user_id, user_name, openid, type, description }) => {
  let doc = {
    user_id,
    user_name,
    openid,
    type,
    description: description || 'ok',
    date: new Date().toISOString()
  }
  logModel.create(doc)
}

module.exports = {
  insertLog,
  login: async (req, res) => {
    const { code } = req.body
    request(
      `https://api.weixin.qq.com/sns/jscode2session?appid=${AppID}&secret=${AppSecret}&js_code=${code}&grant_type=authorization_code`,
      async (error, response, body) => {
        if (!error && response.statusCode == 200) {
          const openid = JSON.parse(body).openid
          delete req.body.code
          const last_date = new Date().toISOString()
          const user = await userModel.findOne({ openid })
          const devToolFormId = 'the formId is a mock one'
          const formIdFromResBody = req.body.formId
          const flag = formIdFromResBody !== devToolFormId
          if (user) {
            let formIds
            if (user.formId) {
              let formIdFromUser = user.formId.split(',')
              flag && formIdFromUser.push(formIdFromResBody)
              formIds = formIdFromUser.slice(-7).join(',')
            } else {
              if (flag) {
                formIds = formIdFromResBody
              }
            }
            delete req.body.formId
            userModel.findOneAndUpdate(
              { openid },
              { ...req.body, last_date, formId: formIds },
              (err, doc) => {
                flag &&
                  insertLog({
                    user_id: doc._id,
                    user_name: doc.nickName,
                    openid: doc.openid,
                    type: 'login',
                    description: err
                  })
                const { _id, openid } = doc
                res.json(
                  ApiResponse({
                    state: true,
                    data: { _id, openid },
                    message: '登录成功'
                  })
                )
              }
            )
          } else {
            if (!flag) {
              delete req.body.formId
            }
            userModel.findOneAndUpdate(
              { openid },
              {
                ...req.body,
                formId: '',
                date: last_date,
                last_date
              },
              { new: true, upsert: true },
              (err, doc) => {
                flag &&
                  insertLog({
                    user_id: doc._id,
                    user_name: doc.nickName,
                    openid: doc.openid,
                    type: 'login',
                    description: err
                  })
                const { _id, openid } = doc
                res.json(
                  ApiResponse({
                    state: true,
                    data: { _id, openid },
                    message: '登录成功'
                  })
                )
              }
            )
          }
        } else {
          insertLog({
            type: 'login',
            description: error
          })
        }
      }
    )
  },
  findEventsByUserId: async (req, res) => {
    const { user_id } = req.params
    const result = await eventModel
      .find({ user_id, $or: [{ delete: { $exists: false } }, { delete: 0 }] })
      .sort({ level: -1, edit_time: -1, date: -1 })
    result &&
      res.json(
        ApiResponse({
          state: true,
          data: result
        })
      )
  },
  findEventByEventId: async (req, res) => {
    const { user_id, event_id } = req.params
    const result = await eventModel.findOne({ user_id, _id: event_id })
    result &&
      res.json(
        ApiResponse({
          state: true,
          data: result
        })
      )
  },
  addEvents: async (req, res) => {
    const date = new Date().toISOString()
    const edit_time = date
    const result = await eventModel.create({ ...req.body, date, edit_time })
    result &&
      res.json(
        ApiResponse({
          state: true,
          data: result,
          message: '添加成功'
        })
      )
  },
  editEvents: async (req, res) => {
    const edit_time = new Date().toISOString()
    const { event_id, title, description, level } = req.body
    const doc = title ? { title, description, level, edit_time } : { edit_time }
    const _id = global.ObjectId(event_id)
    const result = await eventModel.updateOne({ _id }, doc)
    result &&
      res.json(
        ApiResponse({
          state: true,
          message: '操作成功'
        })
      )
  },
  delEvent: async (req, res) => {
    const { event_id } = req.params
    const result = await eventModel.updateOne({ _id: event_id }, { delete: 1 })
    result &&
      res.json(
        ApiResponse({
          state: true,
          message: '删除成功'
        })
      )
  },
  eventStatistics: async (req, res) => {
    const { user_id } = req.params
    const allEvents = await eventModel.find({
      user_id,
      $or: [{ delete: { $exists: false } }, { delete: 0 }]
    })
    let tasks = allEvents.map(async event => {
      return {
        event_id: event._id,
        data: await taskModel.find({
          event_id: event._id,
          $or: [{ delete: { $exists: false } }, { delete: 0 }]
        })
      }
    })
    let tasksResult = await Promise.all([...tasks])
    let tasksStatisticObj = {}
    tasksResult.forEach(eachEventTasks => {
      const { event_id, data } = eachEventTasks
      if (data.length === 0) {
        tasksStatisticObj[event_id] = {
          isDone: 0,
          all: 0
        }
      } else {
        const isDone = data.filter(v => v.state === 1).length
        tasksStatisticObj[event_id] = {
          isDone,
          all: data.length
        }
      }
    })
    res.json(
      ApiResponse({
        state: true,
        data: tasksStatisticObj
      })
    )
  },
  findTasksByEventId: async (req, res) => {
    const { event_id } = req.params
    const result = await taskModel
      .find({ event_id, $or: [{ delete: { $exists: false } }, { delete: 0 }] })
      .sort({ date: -1, state: -1, level: -1 })
    result &&
      res.json(
        ApiResponse({
          state: true,
          data: result
        })
      )
  },
  findTaskByTaskId: async (req, res) => {
    const { task_id } = req.params
    const result = await taskModel.findOne({ _id: task_id })
    result &&
      res.json(
        ApiResponse({
          state: true,
          data: result
        })
      )
  },
  addTask: async (req, res) => {
    const date = new Date().toISOString()
    const edit_time = date
    const { content, level, event_id } = req.body
    const result = await taskModel.create({
      event_id,
      content,
      level,
      date,
      edit_time
    })
    await eventModel.updateOne({ _id: event_id }, { edit_time })
    result &&
      res.json(
        ApiResponse({
          state: true,
          data: result,
          message: '添加成功'
        })
      )
  },
  editTask: async (req, res) => {
    const edit_time = new Date().toISOString()
    const { state, task_id, content, level, event_id } = req.body
    const _id = global.ObjectId(task_id)
    const doc = state ? { state, edit_time } : { edit_time, content, level }
    const result = await taskModel.updateOne({ _id }, doc)
    await eventModel.updateOne({ _id: event_id }, { edit_time })
    result &&
      res.json(
        ApiResponse({
          state: true,
          message: '操作成功'
        })
      )
  },
  delTask: async (req, res) => {
    const { task_id } = req.params
    const result = await taskModel.updateOne({ _id: task_id }, { delete: 1 })
    result &&
      res.json(
        ApiResponse({
          state: true,
          message: '删除成功'
        })
      )
  },
  findAllVersion: async (req, res) => {
    const result = await versionModel.find({}).sort({ date: -1 })
    result &&
      res.json(
        ApiResponse({
          state: true,
          data: result
        })
      )
  },
  releaseNewVersion: async (req, res) => {
    const date = new Date().toISOString()
    const result = await versionModel.create({ ...req.body, date })
    result &&
      res.json(
        ApiResponse({
          state: true,
          data: result,
          message: '发布成功'
        })
      )
  },
  findAllPunch: async (req, res) => {
    const { user_id } = req.params
    const result = await punchModel
      .find({ user_id, $or: [{ delete: { $exists: false } }, { delete: 0 }] })
      .sort({ state: 1, date: -1 })
    let data = []
    result.forEach(v => {
      const allDays =
        (new Date(formatYMD(new Date(v.end_date))).getTime() -
          new Date(formatYMD(new Date(v.start_date))).getTime()) /
          (24 * 3600 * 1000) +
        1
      const okDays = v.punchHistory ? Object.keys(v.punchHistory).length : 0
      let noOkDays =
        (new Date(formatYMD(new Date())).getTime() -
          new Date(formatYMD(new Date(v.start_date))).getTime()) /
          (24 * 3600 * 1000) -
        v.okDays
      noOkDays = noOkDays <= 0 ? 0 : noOkDays
      const today = v.punchHistory
        ? Object.keys(v.punchHistory).indexOf(formatYMD(new Date())) !== -1
          ? true
          : false
        : false
      const start_date = formatYMD(new Date(v.start_date))
      const end_date = formatYMD(new Date(v.end_date))
      const start_date_format = formatYMD(new Date(v.start_date))
        .slice(5)
        .split('-')
      const end_date_format = formatYMD(new Date(v.end_date))
        .slice(5)
        .split('-')
      data.push({
        ...v._doc,
        allDays,
        okDays,
        noOkDays,
        today,
        start_date,
        end_date,
        start_date_format,
        end_date_format
      })
    })
    result &&
      res.json(
        ApiResponse({
          state: true,
          data
        })
      )
  },
  addPunch: async (req, res) => {
    const date = new Date().toISOString()
    const edit_time = date
    const obj = {
      date,
      edit_time,
      ...req.body
    }
    const result = await punchModel.create(obj)
    result &&
      res.json(
        ApiResponse({
          state: true,
          data: result,
          message: '添加成功'
        })
      )
  },
  editPunch: async (req, res) => {
    const edit_time = new Date().toISOString()
    const {
      punch_id,
      today,
      start_date,
      end_date,
      name,
      description
    } = req.body
    const punch = await punchModel.findOne({ _id: punch_id })
    if (today) {
      if (
        new Date(today).getTime() < new Date(punch.start_date) ||
        new Date(today).getTime() > new Date(punch.end_date) ||
        today !== formatYMD(new Date())
      ) {
        res.json(
          ApiResponse({
            state: true,
            message: '注意打卡时间'
          })
        )
        return
      }
      const punchHistory = punch.punchHistory || {}
      if (punchHistory[today]) {
        res.json(
          ApiResponse({
            state: true,
            message: '已经打过卡了'
          })
        )
        return
      }
      const result = await punchModel.updateOne(
        { _id: punch_id },
        {
          punchHistory: {
            ...punchHistory,
            [today]: new Date().toISOString()
          },
          edit_time
        }
      )
      const punchDaysLen =
        (new Date(punch.end_date).getTime() -
          new Date(punch.start_date).getTime()) /
        (24 * 3600 * 1000)
      if (Object.keys(punchHistory).length === punchDaysLen) {
        await punchModel.updateOne({ _id: punch_id }, { state: 1 })
      }
      result &&
        res.json(
          ApiResponse({
            state: true,
            message: '打卡成功'
          })
        )
    } else {
      const result = await punchModel.updateOne(
        { _id: punch_id },
        { start_date, end_date, name, description, edit_time }
      )
      result &&
        res.json(
          ApiResponse({
            state: true,
            message: '编辑成功'
          })
        )
    }
  },
  delPunch: async (req, res) => {
    const { punch_id } = req.params
    const result = await punchModel.updateOne({ _id: punch_id }, { delete: 1 })
    result &&
      res.json(
        ApiResponse({
          state: true,
          message: '删除成功'
        })
      )
  },
  getConfig: async (req, res) => {
    const date = new Date(formatYMD(new Date()))
    const result = await configModel.findOne({ date })
    result &&
      res.json(
        ApiResponse({
          state: true,
          data: result
        })
      )
  },
  addConfig: async (req, res) => {
    const date = formatYMD(new Date(req.body.date))
    const config = req.body.config
    const result = await configModel.create({ date, config })
    result &&
      res.json(
        ApiResponse({
          state: true,
          message: '操作成功'
        })
      )
  }
}
