const express = require('express')
const cors = require('cors')
const winston = require('winston')
const _ = require('lodash')

const app = express()
app.set('port', 4000)

app.use(cors())

const logFormat = winston.format.printf(({ level, message }) => {
  return `${new Date().toISOString()} [${level}]: ${message}`
})

const logConsole = new winston.transports.Console({
  format: winston.format.combine(winston.format.colorize(), logFormat)
})
winston.add(logConsole)

// mock M2M
app.post('/v5/auth0', (req, res) => {
  winston.info('Received Auth0 request')
  // return config/test.js#M2M_FULL_ACCESS_TOKEN
  res.status(200).json({ access_token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL3RvcGNvZGVyLWRldi5hdXRoMC5jb20vIiwic3ViIjoiZW5qdzE4MTBlRHozWFR3U08yUm4yWTljUVRyc3BuM0JAY2xpZW50cyIsImF1ZCI6Imh0dHBzOi8vbTJtLnRvcGNvZGVyLWRldi5jb20vIiwiaWF0IjoxNTUwOTA2Mzg4LCJleHAiOjE2ODA5OTI3ODgsImF6cCI6ImVuancxODEwZUR6M1hUd1NPMlJuMlk5Y1FUcnNwbjNCIiwic2NvcGUiOiJhbGw6bWVtYmVycyIsImd0eSI6ImNsaWVudC1jcmVkZW50aWFscyJ9.Eo_cyyPBQfpWp_8-NSFuJI5MvkEV3UJZ3ONLcFZedoA' })                                              
})

// mock event bus
app.post('/v5/bus/events', (req, res) => {
  winston.info('Received bus events');
  res.status(200).json({});
});


app.post('/v5/looker/login', (req, res) => {
  winston.info('Returning looker access token')
  res.status(200).json({
    access_token: 'fake-token'
  })
})

app.post('/v5/looker/queries/*', (req, res) => {
  winston.info('Querying looker API')
  res.status(200).json({})
})

app.use((req, res) => {
  res.status(404).json({ error: 'route not found' })
})

app.use((err, req, res, next) => {
  winston.error(err)
  res.status(500).json({
    error: err.message
  })
})

app.listen(app.get('port'), '0.0.0.0', () => {
  winston.info(`Express server listening on port ${app.get('port')}`)
})

