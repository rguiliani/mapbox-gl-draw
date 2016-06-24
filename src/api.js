var hat = require('hat');
var featuresAt = require('./lib/features_at');
var geojsonhint = require('geojsonhint');

var featureTypes = {
  'Polygon': require('./feature_types/polygon'),
  'LineString': require('./feature_types/line_string'),
  'Point': require('./feature_types/point'),
  'MultiPolygon': require('./feature_types/multi_feature'),
  'MultiLineString': require('./feature_types/multi_feature'),
  'MultiPoint': require('./feature_types/multi_feature')
};

var featureTypeStr = Object.keys(featureTypes).join(', ');

module.exports = function(ctx) {

  return {
    getFeatureIdsAt: function(x, y) {
      var features = featuresAt({point: {x, y}}, null, ctx);
      return features.map(feature => feature.properties.id);
    },
    getSelectedIds: function () {
      return ctx.store.getSelectedIds();
    },
    add: function (geojson, validateGeoJSON=true) {
       if (geojson.type !== 'FeatureCollection' && !geojson.geometry) {
        geojson = {
          type: 'Feature',
          id: geojson.id,
          properties: geojson.properties || {},
          geometry: geojson
        };
      }

      if (validateGeoJSON) {
        var errors = geojsonhint.hint(geojson);
        if (errors.length) {
          throw new Error(errors[0].message);
        }

        (geojson.type === 'FeatureCollection' ? geojson.features : [geojson]).forEach(feature => {
          if (featureTypes[feature.geometry.type] === undefined) {
            throw new Error(`Invalid feature type. Must be ${featureTypeStr}`);
          }
        });
      }

      if (geojson.type === 'FeatureCollection') {
        return geojson.features.map(feature => this.add(feature, false));
      }

      geojson = JSON.parse(JSON.stringify(geojson));

      geojson.id = geojson.id || hat();

      if (ctx.store.get(geojson.id) === undefined) {
        var model = featureTypes[geojson.geometry.type];

        let internalFeature = new model(ctx, geojson);
        ctx.store.add(internalFeature);
      }
      else {
        let internalFeature = ctx.store.get(geojson.id);
        internalFeature.properties = geojson.properties;
        internalFeature.incomingCoords(geojson.geometry.coordinates);
      }
      ctx.store.render();
      return geojson.id;
    },
    get: function (id) {
      var feature = ctx.store.get(id);
      if (feature) {
        return feature.toGeoJSON();
      }
    },
    getAll: function() {
      return {
        type: 'FeatureCollection',
        features: ctx.store.getAll().map(feature => feature.toGeoJSON())
      };
    },
    delete: function(id) {
      ctx.store.delete([id], { silent: true });
      ctx.store.render();
    },
    deleteAll: function() {
      ctx.store.delete(ctx.store.getAllIds(), { silent: true });
      ctx.store.render();
    },
    changeMode: function(mode, modeOptions) {
      ctx.events.changeMode(mode, modeOptions, { silent: true });
    },
    trash: function() {
      ctx.events.trash({ silent: true });
    }
  };
};
