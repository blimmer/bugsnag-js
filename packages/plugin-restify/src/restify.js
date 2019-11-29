const domain = require('domain') // eslint-disable-line
const extractRequestInfo = require('./request-info')
const createEventFromErr = require('@bugsnag/core/lib/event-from-error')
const clone = require('@bugsnag/core/lib/clone-client')
const handledState = {
  severity: 'error',
  unhandled: true,
  severityReason: {
    type: 'unhandledErrorMiddleware',
    attributes: { framework: 'Restify' }
  }
}

module.exports = {
  name: 'restify',
  init: client => {
    const requestHandler = (req, res, next) => {
      const dom = domain.create()

      // Get a client to be scoped to this request. If sessions are enabled, use the
      // startSession() call to get a session client, otherwise, clone the existing client.
      const requestClient = client.config.autoTrackSessions ? client.startSession() : clone(client)

      // attach it to the request
      req.bugsnag = requestClient

      // extract request info and pass it to the relevant bugsnag properties
      const { request, metaData } = getRequestAndMetaDataFromReq(req)
      requestClient.metaData = { ...requestClient.metaData, request: metaData }
      requestClient.request = request

      // unhandled errors caused by this request
      dom.on('error', (err) => {
        req.bugsnag.notify(createEventFromErr(err, handledState), () => {}, (e, event) => {
          if (e) client._logger.error('Failed to send event to Bugsnag')
          req.bugsnag.config.onUncaughtException(err, event, client._logger)
        })
        if (!res.headersSent) {
          const body = 'Internal server error'
          res.writeHead(500, {
            'Content-Length': Buffer.byteLength(body),
            'Content-Type': 'text/plain'
          })
          res.end(body)
        }
      })

      return dom.run(next)
    }

    const errorHandler = (req, res, err, cb) => {
      if (err.statusCode && err.statusCode < 500) return cb()
      if (req.bugsnag) {
        req.bugsnag.notify(createEventFromErr(err, handledState))
      } else {
        client._logger.warn(
          'req.bugsnag is not defined. Make sure the @bugsnag/plugin-restify requestHandler middleware is added first.'
        )
        client.notify(createEventFromErr(err, handledState), (event) => {
          const { metaData, request } = getRequestAndMetaDataFromReq(req)
          event.request = { ...request }
          event.metaData = { ...metaData }
        })
      }
      cb()
    }

    return { requestHandler, errorHandler }
  }
}

const getRequestAndMetaDataFromReq = req => {
  const requestInfo = extractRequestInfo(req)
  return {
    metaData: requestInfo,
    request: {
      clientIp: requestInfo.clientIp,
      headers: requestInfo.headers,
      httpMethod: requestInfo.httpMethod,
      url: requestInfo.url,
      referer: requestInfo.referer
    }
  }
}

module.exports.default = module.exports
