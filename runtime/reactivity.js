const Handler = {
    set(target, prop, receiver) {

        if (target[prop] != null || target[prop] != undefined) {
            target[prop] = receiver;
            document.querySelectorAll(`nrv[var="${prop}"]`).forEach(el => {
                el.innerText = receiver;
            });
        } else {
            target[prop] = receiver;
        }

        return true;
    }
};

export default new Proxy({}, Handler);