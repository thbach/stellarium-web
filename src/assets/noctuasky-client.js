// Stellarium Web - Copyright (c) 2018 - Noctua Software Ltd
//
// This program is licensed under the terms of the GNU AGPL v3, or
// alternatively under a commercial licence.
//
// The terms of the AGPL v3 license can be found in the main directory of this
// repository.

import Swagger from 'swagger-client'
import _ from 'lodash'
import store from 'store'

var swaggerClient

const NoctuaSkyClient = {
  currentUser: undefined,
  init: function (serverUrl) {
    let that = this
    return Swagger(serverUrl + '/doc/openapi.json', {
      authorizations: {
        APIToken: ''
      },
      requestInterceptor: req => {
        if (req.body && !req.headers['Content-Type']) {
          req.headers['Content-Type'] = 'application/json'
        }
      }
    }).then(client => {
      console.log('Initialized NoctuaSky Client')
      swaggerClient = client
      let removeTrailingNumbers = function (val, key) { return key.replace(/\d+$/, '') }
      that.observations = _.mapKeys(client.apis.observations, removeTrailingNumbers)
      that.locations = _.mapKeys(client.apis.locations, removeTrailingNumbers)
      that.users = _.mapKeys(client.apis.users, removeTrailingNumbers)

      let clientApisSkysources = _.mapKeys(client.apis.skysources, removeTrailingNumbers)

      that.skysources = {
        query: function (str, limit, exact = null) {
          if (limit === undefined) {
            limit = 10
          }
          str = str.toUpperCase()
          str = str.replace(/\s+/g, '')
          return clientApisSkysources.query({q: str, limit: limit, exact: exact}).then(res => {
            return res.body
          }, err => {
            throw err.response
          })
        },

        // Get data for a SkySource from its NSID in papi service
        get: function (nsid) {
          return clientApisSkysources.get({nsid: nsid}).then(res => {
            return res.body
          }).catch(err => {
            throw err.response
          })
        }
      }

      let token = store.get('noctuasky_token')
      if (token) {
        console.log('Found previous token, try to re-use..')
        swaggerClient.authorizations.APIToken = token
        that.users.get({user_id: 'me'}).then((res) => {
          console.log('NoctuaSky Login successful')
          that.currentUser = res.body
          return that.currentUser
        }, (error) => {
          console.log("Couldn't re-use saved token:" + error)
          that.logout()
        })
      }
    }, error => {
      console.log('Could not initialize NoctuaSky Client at ' + serverUrl + ' ' + error)
    })
  },
  login: function (email, password) {
    let that = this
    return swaggerClient.apis.users.login({body: {email: email, password: password}}).then((res) => {
      that.currentUser = res.body
      swaggerClient.authorizations.APIToken = 'Bearer ' + res.body.access_token
      store.set('noctuasky_token', swaggerClient.authorizations.APIToken)
      delete that.currentUser.access_token
      console.log('NoctuaSky Login successful')
      return {code: res.status, user: that.currentUser}
    })
  },
  logout: function () {
    store.remove('noctuasky_token')
    swaggerClient.authorizations.APIToken = ''
    this.currentUser = undefined
  },
  register: function (email, password, firstName, lastName) {
    return this.users.add({body: {email: email, password: password, first_name: firstName, last_name: lastName}}).then((res) => {
      console.log('NoctuaSky Register successful')
      return res.response
    })
  }
}

export default NoctuaSkyClient