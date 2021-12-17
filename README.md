# mt-webauthn-simple

This is a proof-of-concept to show how webauthn can be integrated into a website.  I also treated it as an introduction to TypeScript for myself; I've been aware of TS for a long time, but I never had a real need to use it.  This gave me an excuse to play with it.

## Dependencies

What I wrote depends on MongoDB to store user and authenticator data.  Otherwise, it's just JS/TS.

## What?

I once [read something](https://medium.com/@vrypan/explaining-public-key-cryptography-to-non-geeks-f0994b3c2d5) that gave a nice layperson explanation of what to expect from public key cryptography.

The idea with this application is this:
A client arrives and tells the server that it wants to exchange keys.  The server says ok and gives the client a challenge string to sign.  The client signs the string and gives it back, along with the public half of the key used to sign it.  The server uses the public key to verify that, yes, that challenge string was signed by the private keyholder (the client).

The client will come back some day and want to log in.  The server says, "You're user ID 123456?  Ok, here's a challenge string.  Sign it and I'll verify that you are who you say you are."  The client signs that challenge string (with the private key they always have) and sends the result back to the server (who already has the public key on record for that user).  The server verifies, and if the crypto math works out, the client is verified.  If not, client is denied.

In this case, the keypair is generated using one of Windows Hello, Android fingerprint, iPhone FaceID, or it could be configured to use a cross-platform solution like a Yubikey.  The browser (most browsers support this now) will use the appropriate interface to initiate the crypto stuff on the client-side.