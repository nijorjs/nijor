export default (min, max) => {
    const length = Math.floor(Math.random() * (max - min + 1) + min);
    const firstChars = 'abcdefghijklmnopqrstuvwxyz';
    const otherChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = firstChars.charAt(Math.floor(Math.random() * firstChars.length));

    for (let i = 1; i < length; i++) {
        result += otherChars.charAt(
            Math.floor(Math.random() * otherChars.length)
        );
    }

    return result;
}