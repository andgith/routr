/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/core/resources.js')
load('mod/utils/auth_helper.js')

function RegistrarService(location, getUser = getUserFromConfig) {
    const LogManager = Packages.org.apache.logging.log4j.LogManager
    const LOG = LogManager.getLogger()
    const authHelper = new AuthHelper()

    function hasDomain(user, domain) {
        for (var d of user.domains) {
           if (domain === d) return true
        }
        return false
    }

    function getNonceCount(d) {
        const h = Java.type("java.lang.Integer").toHexString(d)
        const cSize = 8 - h.toString().length()
        let nc = ''
        let cnt = 0

        while (cSize > cnt) {
            nc += "0"
            cnt++
        }

        return nc + h
    }

    this.register = (authHeader, uriDomain, contactURI) => {
        // Get response from header
        const response = authHeader.getResponse()
        // Get username and password from "db:
        const user = getUser(authHeader.getUsername())

        if (user == null) {
            LOG.info("Could not find user or peer '" + authHeader.getUsername() + "'")
            return false
        }

        // TODO: Should verify if domain exist first...

        if (user.kind.equalsIgnoreCase('agent') && !hasDomain(user, uriDomain)) {
            LOG.info("User " + user.username + " does not exist in domain " + uriDomain)
            return false
        }

        const aHeaderJson = {
            username: authHeader.getUsername(),
            password: user.secret,
            realm: authHeader.getRealm(),
            nonce: authHeader.getNonce(),
            // For some weird reason the interface value is an int while the value original value is a string
            nc: getNonceCount(authHeader.getNonceCount()),
            cnonce: authHeader.getCNonce(),
            uri: authHeader.getURI().toString(),
            method: 'REGISTER',
            qop: authHeader.getQop()
        }

        if (new AuthHelper().calcFromHeader(aHeaderJson).equals(response)) {

            if (user.kind.equalsIgnoreCase('peer')) {
                if (user.host != null) {
                    contactURI.setHost(user.host)
                }

                const endpoint = "sip:" + authHeader.getUsername() + "@" + uriDomain
                location.put(endpoint, contactURI)

                LOG.debug("The endpoint " + endpoint + " is " + contactURI + " in Sip I/O")
            } else {
                for (var domain of user.domains) {
                    // TODO: Find a better way to get this value
                    // This could be "sips" or other protocol
                    const endpoint = "sip:" + authHeader.getUsername() + "@" + domain
                    location.put(endpoint, contactURI)
                    LOG.debug("The endpoint " + endpoint + " is " + contactURI + " in Sip I/O")
                }
            }

            return true
        }
        return false
    }
}