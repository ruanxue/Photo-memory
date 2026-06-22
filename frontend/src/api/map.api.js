import request from './request.js';

export const mapApi = {
  photos: (params) => request.get('/map/photos', { params }),
  cities: () => request.get('/map/cities'),
  countries: () => request.get('/map/countries'),
  years: () => request.get('/map/years'),
  places: (params) => request.get('/map/places', { params }),
  geocode: (params) => request.get('/map/geocode', { params }),
  reverseGeocode: (params) => request.get('/map/reverse-geocode', { params })
};
