var GeoSeverPassword = "geoserver";
var GeoSeverUser = "admin";
export const GEOSERVER_URL = 'http://192.168.7.70:8080/geoserver';
export const AUTH_HEADER = 'Basic ' + btoa(GeoSeverUser + ':' + GeoSeverPassword);
export const WORKSPACE = 'gisweb';
