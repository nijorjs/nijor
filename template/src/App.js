import "nijor";
import "nijor/router";
import App from 'App.nijor';

//@Routes()

App.init('app');
(async ()=>await App.run())();
window.nijor.renderRoute(window.location.pathname);