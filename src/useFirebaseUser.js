import { useEffect, useState } from 'react'
import { getIdTokenResult, onIdTokenChanged } from 'firebase/auth'
import { getConfig } from 'src/config'
import createAuthUser from 'src/createAuthUser'
import { filterStandardClaims } from 'src/claims'

const defaultTokenChangedHandler = async (authUser) => {
  const { loginAPIEndpoint, logoutAPIEndpoint } = getConfig()
  let response
  // If the user is authed, call login to set a cookie.
  if (authUser.id) {
    const userToken = await authUser.getIdToken()
    response = await fetch(loginAPIEndpoint, {
      method: 'POST',
      headers: {
        Authorization: userToken,
      },
      credentials: 'include',
    })
    if (!response.ok) {
      const responseJSON = await response.json()
      throw new Error(
        `Received ${
          response.status
        } response from login API endpoint: ${JSON.stringify(responseJSON)}`
      )
    }
  } else {
    // If the user is not authed, call logout to unset the cookie.
    response = await fetch(logoutAPIEndpoint, {
      method: 'POST',
      credentials: 'include',
    })
    if (!response.ok) {
      const responseJSON = await response.json()
      throw new Error(
        `Received ${
          response.status
        } response from logout API endpoint: ${JSON.stringify(responseJSON)}`
      )
    }
  }
  return response
}

const setAuthCookie = async (firebaseUser) => {
  const { tokenChangedHandler } = getConfig()

  const authUser = createAuthUser({
    firebaseUserClientSDK: firebaseUser,
    clientInitialized: true,
  })

  if (tokenChangedHandler) {
    return tokenChangedHandler(authUser)
  }

  return defaultTokenChangedHandler(authUser)
}

const useFirebaseUser = () => {
  const [user, setUser] = useState()
  const [customClaims, setCustomClaims] = useState({})
  const [initialized, setInitialized] = useState(false)

  async function onIdTokenChange(firebaseUser) {
    if (firebaseUser) {
      // Get the user's claims:
      // https://firebase.google.com/docs/reference/js/firebase.auth.IDTokenResult
      const idTokenResult = await getIdTokenResult()
      const claims = filterStandardClaims(idTokenResult.claims)
      setCustomClaims(claims)
    }
    setUser(firebaseUser)
    setInitialized(true)
    await setAuthCookie(firebaseUser)
  }

  useEffect(() => {
    // https://firebase.google.com/docs/reference/js/firebase.auth.Auth#onidtokenchanged
    const unsubscribe = onIdTokenChanged(onIdTokenChange)
    return () => unsubscribe()
  }, [])

  return {
    user, // unmodified Firebase user, undefined if not authed
    claims: customClaims,
    initialized,
  }
}

export default useFirebaseUser
