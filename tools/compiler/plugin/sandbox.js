export function runComponents(element, scope) {
    let runFn = '';
    let allComponents = [];
    const regex = new RegExp(`\\w+_${scope}`);
    let childComponents = [...element.querySelectorAll('*')].filter(el => regex.test(el.tagName.toLowerCase()));

    childComponents.forEach(component => {
        const componentName = component.tagName.toLowerCase();
        allComponents.push(componentName);
        runFn += `$${componentName}.init('${componentName}');await $${componentName}.run();`;
    });

    return [runFn, allComponents];
}