import path from 'path';

export default function ({document, scripts, filename}) {

    document.body.querySelectorAll('[n:slot]').forEach(child => {
        let id = path.basename(filename).slice(0, -6);
        child.id = `layout-${id}`;
        child.removeAttribute('n:slot');
    });

    return ({
        name: "Slot",
        data:{
        body: document.body.innerHTML,
        ...scripts
        }
    });
}