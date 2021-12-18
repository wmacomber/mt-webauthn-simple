const { startRegistration, startAuthentication } = SimpleWebAuthnBrowser;

const elemRegBegin = document.getElementById("reg_button");
const elemRegMessage = document.getElementById("reg_message");
const elemLoginBegin = document.getElementById("login_button");
const elemLoginMessage = document.getElementById("login_message");

elemRegBegin.addEventListener("click", async () => {
    elemRegMessage.innerHTML = "";

    const userId = String(document.getElementById("reg_userId").value).trim();
    if (userId === "") {
        elemRegMessage.innerHTML = "You need a user ID";
        return false;
    }

    const resp = await fetch("register/options", {
        "method": "POST", 
        "body": JSON.stringify({
            "userId": userId,
            "userName": document.getElementById("reg_userName").value,
            "displayName": document.getElementById("reg_displayName").value
        }),
        "headers": { "Content-Type": "application/json" }
    });
    const respJSON = await resp.json();

    let attResp;
    try {
        attResp = await startRegistration(respJSON);
    } catch (exc) {
        if (exc.name === "InvalidStateError") {
            elemRegMessage.innerText = "Error: Authenticator was probably already registered to user";
        } else {
            elemRegMessage.innerText = exc;
        }
        throw exc;
    }

    const verResp = await fetch(`register/verify/${userId}`, {
        "method": "POST",
        "body": JSON.stringify(attResp),
        "headers": { "Content-Type": "application/json" }
    });
    const verRespJSON = await verResp.json();
    if (verRespJSON && verRespJSON.verified) {
        elemRegMessage.innerHTML = "Successfully registered";
    } else {
        elemRegMessage.innerHTML = "Error during registration";
    }
});

elemLoginBegin.addEventListener("click", async () => {
    elemLoginMessage.innerHTML = "";

    const userId = String(document.getElementById("login_userId").value).trim();
    if (userId === "") {
        elemLoginMessage.innerHTML = "You need a user ID";
        return false;
    }

    const resp = await fetch(`auth/options/${userId}`);
    const respJSON = await resp.json();

    let authResp;
    try {
        authResp = await startAuthentication(respJSON);
    } catch (exc) {
        if (exc.name === "TypeError") {
            elemLoginMessage.innerText = "Account probably doesn't exist";
        } else {
            elemLoginMessage.innerText = exc;
        }
        throw exc;
    }

    const verResp = await fetch(`auth/verify/${userId}`, {
        "method": "POST",
        "body": JSON.stringify(authResp),
        "headers": { "Content-Type": "application/json" }
    });
    const verRespJSON = await verResp.json();
    if (verRespJSON && verRespJSON.verified) {
        elemLoginMessage.innerHTML = "Logged in successfully";
    } else {
        elemLoginMessage.innerHTML = "Error during login";
    }
});