const _ = require('lodash')
const jwt = require('jsonwebtoken')

/**
 * @function
 * @private
 *
 * Extract bearer token out of header.
 * https://tools.ietf.org/html/rfc7519
 *
 * @param {string} field The header field to be scanned
 * @returns {string} The extracted header
 */
function getToken (field) {
  return /^(?:bearer) ([a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.([a-zA-Z0-9\-_]+)?)$/i.exec(field)
}

/**
 * @function
 * @private
 *
 * Get function prefixing role with respective key.
 *
 * @param {string} clientId The current client its identifier
 * @param {string} key The role its key
 * @returns {Function} The composed prefixing function
 */
function prefixRole (clientId, key) {
  return (role) => key === clientId ? role : `${key}:${role}`
}

/**
 * @function
 * @private
 *
 * Get roles out of token content.
 * Exclude `account` roles and prefix realm roles
 * with `realm:`. Roles of other resources are prefixed
 * with their name.
 *
 * @param {string} clientId The current client its identifier
 * @param {Object} [realm] The realm access data
 * @param {Object} [resource] The resource access data
 * @returns {Array.<?string>} The list of roles
 */
function getRoles (clientId, {
  realm_access: realm = { roles: [] },
  resource_access: resources = {},
  authorization: auth = { permissions: [] }
}) {
  const prefix = prefixRole.bind(undefined, clientId)
  const realmRoles = realm.roles.map(prefix('realm'))
  const scopes = _.flatten(_.map(auth.permissions, 'scopes')).map(prefix('scope'))
  const appRoles = Object.keys(resources).map((key) => resources[key].roles.map(prefix(key)))

  return _.flattenDepth([realmRoles, scopes, appRoles], 2)
}

/**
 * @function
 * @private
 *
 * Get expiration out of token content.
 * If `exp` or `iat` is undefined just 60
 * seconds as default expiration time.
 *
 * @param {number} exp The `expiration` timestamp in seconds
 * @param {number} iat The `issued at` timestamp in seconds
 * @returns {number} The expiration delta in milliseconds
 */
function getExpiration ({ exp, iat }) {
  return [exp, iat].includes(undefined) ? 60 * 1000 : (exp - iat) * 1000
}

/**
 * @function
 * @private
 *
 * Get necessary user information out of token content.
 *
 * @param {Object} content The token its content
 * @param {Array.<?string>} [fields] The necessary fields
 * @returns {Object} The collection of requested user info
 */
function getUserInfo (content, fields = []) {
  return _.pick(content, ['sub', ...fields])
}

/**
 * @function
 * @public
 *
 * Get various data out of token content.
 * Get the current scope of the user and
 * when the token expires.
 *
 * @param {string} tkn The token to be checked
 * @param {string} clientId The current client its identifier
 * @param {Array.<?string>} [userInfoFields] The necessary user info fields
 * @returns {Object} The extracted data
 */
function getData (tkn, { clientId, userInfoFields }) {
  const content = jwt.decode(tkn)
  const scope = getRoles(clientId, content)

  return {
    expiresIn: getExpiration(content),
    credentials: Object.assign({ scope }, getUserInfo(content, userInfoFields))
  }
}

/**
 * @function
 * @public
 *
 * Get token out of header field.
 *
 * @param {string} field The header field to be scanned
 * @returns {string|false} The token or `false` dependent on field
 */
function create (field) {
  const match = getToken(field)

  return match ? match[1] : false
}

module.exports = {
  create,
  getData
}
