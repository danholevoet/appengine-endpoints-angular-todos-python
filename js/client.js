//
// Copyright 2014 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

/**
 * @fileoverview AngularJS module to support apps consuming Google APIs using
 * the Google API JavaScript Client.
 *
 * The APIs used can be configured on the googleapiProvider during config:
 *   googleapiProvider.api('calendar', v3)
 * OAuth details should also be specified (unless first-party auth is used):
 *   googleapiProvider.clientId('xxx').
 *                     scope('https://www.googleapis.com/auth/yyy');
 * View controllers can inject APIs using the resolve helper:
 *   $routeProvider.when('/someroute', {
 *     controller: MyCtrl,
 *     resolve: googleapiProvider.resolve(['calendar'])
 *   });
 *   function MyCtrl(calendar, googleapi, $scope) {
 *     var request = calendar.calendarList.list({}); // see gapi.client.calendar
 *     $scope.calendar = googleapi.execute(request); // returns a promise
 *   }
 * If explicit auth is required, users will be directed to the /authorize route:
 *   $routeProvider.when('/authorize', {
 *     controller: 'googleapiAuthorizeCtrl',
 *     template: '<button ng-click="authorize()">OK</button>'
 *   });
 *
 * See demo.html in this directory for a complete example.
 * For more details, see the design doc at http://go/5a.
 * Documentation on the Google API Javascript Client:
 *   https://developers.google.com/api-client-library/javascript/reference/referencedocs
 */
var ng = ng || {};
ng.googleapi = ng.googleapi || {};
ng.googleapi.gapi = ng.googleapi.gapi || {};
ng.googleapi.oauth = ng.googleapi.oauth || {};
ng.googleapi.client = ng.googleapi.client || {};

/**
 * Service for a particular API, injectable as e.g. calendarService, where the
 * calendar API was configured on the GoogleAPIProvider.
 * This provides access to one configured API.
 * @constructor
 * @param {string} api The service name of this API (e.g. 'calendar').
 * @param {string} version The version of this api (e.g. 'v3').
 * @param {?string} baseUrl API root URL (overrides client default).
 * @param {!oauth.OAuth} oauth The OAuth service.
 * @param {!angular.$injector} $injector The angular $injector service.
 * @ngInject
 */
ng.googleapi.client.APIService = function(api, version, baseUrl, oauth,
    $injector) {
  /** @private {string} */ this.name_ = api;
  /** @private {string} */ this.version_ = version;
  /** @private {?string} */ this.baseUrl_ = baseUrl;
  /** @private {!oauth.OAuth} */ this.oauth_ = oauth;
  /** @private {!angular.$injector} */ this.$injector_ = $injector;
};

/**
 * Attempts to obtain an OAuth token (without prompting) and load this API.
 * If a token cannot be obtained, the returned promise is rejected.
 * @return {!angular.$q.Promise} A promise of the API client interface
 *     (e.g. gapi.client.calendar for calendar API).
 */
ng.googleapi.client.APIService.prototype.promise = function() {
  var self = this, loadService = this.loadService_;
  return self.oauth_.authorizeImmediate().then(function() {
    return self.$injector_.invoke(loadService, self);
  });
};

/**
 * Waits for the API to load, and returns a promise of the API client.
 * @param {!angular.$q} $q The angular $q service.
 * @param {!angular.$q.Promise} gapi A promise of the google API client.
 * @return {!angular.$q.Promise} A promise of the API client interface.
 * @private
 * @ngInject
 */
ng.googleapi.client.APIService.prototype.loadService_ = function($q, gapi) {
  var self = this;
  // Discovery doc loading was requested by GoogleAPIProvider via gapi hook.
  // then() forces loading to complete.
  return gapi.then(function(gapi) {
    return gapi.client[self.name_];
  });
};

/**
 * Google API service provider, injectable as googleapiProvider during config.
 * This lets the user specify details about API usage and authorization.
 * @constructor
 * @param {!angular.$provide} $provide Angular $provide service.
 * @param {!oauth.OAuthProvider} oauthProvider OAuth service configuration.
 * @param {!gapi.GapiProvider} gapiProvider Gapi service configuration.
 * @param {!AuthorizeCtrlConfig} googleapiAuthorizeCtrlConfig Configuration of
 *     auth controller.
 * @ngInject
 */
ng.googleapi.client.GoogleAPIProvider = function($provide, oauthProvider,
    gapiProvider, googleapiAuthorizeCtrlConfig) {
  /** @private {!angular.$provide} */ this.$provide_ = $provide;
  /** @private {!oauth.OAuthProvider} */ this.oauthProvider_ = oauthProvider;
  /** @private {!gapi.GapiProvider} */ this.gapiProvider_ = gapiProvider;
  /** @private {!AuthorizeCtrlConfig} */
  this.googleapiAuthorizeCtrlConfig_ = googleapiAuthorizeCtrlConfig;
  /** @private {?string} */ this.apiKey_ = null;
};

/**
 * Registers an injectable API. This adds an APIService available to
 * the injector with the name {@code api}Service.
 * For example, calling api('calendar', 'v3') makes calendarService injectable.
 * @param {string} api The service name of the API to add (e.g. 'calendar').
 * @param {string} version The version of the API to use (e.g. 'v3').
 * @param {string=} opt_baseUrl The server root to use, instead of the default
 *     (which is usually https://www.googleapis.com).
 * @return {!GoogleAPIProvider} This.
 */
ng.googleapi.client.GoogleAPIProvider.prototype.api = function(api, version,
    opt_baseUrl) {
  var self = this;
  var params = {'api': api, 'version': version, 'baseUrl': opt_baseUrl};
  this.gapiProvider_.hook(ng.googleapi.client.GoogleAPIProvider.loadDiscovery_,
      undefined, params);
  this.$provide_.factory(api + 'Service', ['$injector', function($injector) {
    return $injector.instantiate(ng.googleapi.client.APIService, params);
  }]);
  return this;
};

/**
 * Loads the discovery document for the specified API.
 * @param {string} api The service name of the API to fetch.
 * @param {string} version The version of the API to use.
 * @param {?string} baseUrl The custom base URL to use.
 * @param {?} partialGapi The google API client.
 * @param {!angular.$q} $q The angular $q service.
 * @param {!angular.Scope} $rootScope The root application scope.
 * @return {!angular.$q.Promise} A promise resolved once loading is complete.
 * @ngInject
 * @private
 */
ng.googleapi.client.GoogleAPIProvider.loadDiscovery_ = function(api, version,
    baseUrl, partialGapi, $q, $rootScope) {
  var defer = $q.defer();
  partialGapi.load('client', function() {
    partialGapi.client.load(api, version, function() {
      $rootScope.$apply(function() {
        if (partialGapi.client.hasOwnProperty(api)) {
          defer.resolve(partialGapi.client[api]);
        } else {
          defer.reject(new Error(api + ' not loaded'));
        }
      });
    }, baseUrl || undefined);
  });
  return defer.promise;
};

/**
 * Sets the OAuth client ID to be used.
 * @param {string} clientId The unique ID assigned to the client application.
 *     See https://code.google.com/apis/console.
 * @return {!GoogleAPIProvider} this.
 */
ng.googleapi.client.GoogleAPIProvider.prototype.clientId = function(clientId) {
  this.oauthProvider_.clientId = clientId;
  return this;
};

/**
 * Adds an OAuth scope to be requested. When an OAuth token is needed, the user
 * will be prompted to approve all specified scopes.
 * @param {string} scopeUrl The URL identifying the type of access needed.
 * @return {!GoogleAPIProvider} This.
 */
ng.googleapi.client.GoogleAPIProvider.prototype.scope = function(scopeUrl) {
  this.oauthProvider_.scopes.push(scopeUrl);
  return this;
};

/**
 * Sets the extra parameters to be used in authorization.
 * @param {Object.<string>} params Parameters to be used.
 * @return {!GoogleAPIProvider} This.
 */
ng.googleapi.client.GoogleAPIProvider.prototype.params = function(params) {
  this.oauthProvider_.params = params;
  return this;
};

/**
 * Sets the path of the authorization route, overriding the default /authorize.
 * @param {string} authRoute The path of a route that will be used when an
 *     OAuth token is needed but not available.
 * @return {!GoogleAPIProvider} This.
 */
ng.googleapi.client.GoogleAPIProvider.prototype.authorizeRoute = function(
    authRoute) {
  this.googleapiAuthorizeCtrlConfig_.authRoute = authRoute;
  return this;
};

/**
 * Obtains the Google API service.
 * @param {!angular.$injector} $injector The angular $injector service.
 * @return {!GoogleAPI} The Google API service.
 * @export
 * @ngInject
 */
ng.googleapi.client.GoogleAPIProvider.prototype.$get = function($injector) {
  return /** @type {!GoogleAPI} */ ($injector.instantiate(
      ng.googleapi.client.GoogleAPI));
};

/**
 * Returns a value for the 'resolve' routing option which makes the specified
 * APIs injectable.
 *
 * For example:
 * $routeProvider.when('/viewcalendar/:id', {
 *   resolve: googleapiProvider.resolve(['calendar']),
 *   controller: function(calendar) {
 *     calendar.events.list(...);
 *   },
 *   templateUrl: '/viewcalendar.ng'
 * })
 *
 * Failure to authorize the user and load these APIs results in the user being
 * redirected to the authorize route.
 *
 * The value of resolve(['calendar', 'drive']) is equivalent to:
 * {
 *   calendar: function(calendarService) { return calendarService.promise() },
 *   drive: function(driveService) { return driveService.promise() },
 * }
 *
 * If other promises also need to be resolved, the returned object should be
 * merged with the additional promises the controller needs.
 *
 * @param {!Array.<string>} names The names of the APIs to make injectable.
 * @return {!Object.<!Array.<String|Function>>} Object suitable for passing as
 *     the 'resolve' option of when().
 */
ng.googleapi.client.GoogleAPIProvider.prototype.resolve = function(names) {
  var result = {};
  angular.forEach(names, function(name) {
    result[name] = [name + 'Service', function(s) { return s.promise(); }];
  });
  return result;
};

/**
 * Google API service (injectable as 'googleapi').
 * This contains functionality not specific to a single API.
 * @constructor
 * @param {!angular.$q} $q The angular $q service.
 * @param {!angular.$location} $location The angular $location service.
 * @param {!angular.Scope} $rootScope The application root scope.
 * @param {!AuthorizeCtrlConfig} googleapiAuthorizeCtrlConfig Configuration of
 *     auth controller.
 * @ngInject
 */
ng.googleapi.client.GoogleAPI = function($q, $location, $rootScope,
    googleapiAuthorizeCtrlConfig) {
  /** @private {!angular.$q} */ this.$q_ = $q;
  /** @private {!angular.$location} */ this.$location_ = $location;
  /** @private {!angular.Scope} */ this.$rootScope_ = $rootScope;
  /** @private {!AuthorizeCtrlConfig} */
  this.googleapiAuthorizeCtrlConfig_ = googleapiAuthorizeCtrlConfig;
};

/**
 * Redirects the user to the authorization route.
 * The current location is saved, and returned to when auth is complete.
 * @private
 */
ng.googleapi.client.GoogleAPI.prototype.showAuthPage_ = function() {
  this.googleapiAuthorizeCtrlConfig_.redirectPath = this.$location_.path();
  this.$location_.path(this.googleapiAuthorizeCtrlConfig_.authRoute);
};

/**
 * Executes the specified request, and wraps it in a promise.
 * If the request returns an error response, the promise will be rejected
 * with the error details.
 * @param {{execute: function(function(!Object))}} request An API request.
 * @return {!angular.$q.Promise} A promise which will resolve to the result,
 *     or be rejected with the error response.
 */
ng.googleapi.client.GoogleAPI.prototype.execute = function(request) {
  var defer = this.$q_.defer();
  var self = this;
  request.execute(function(response) {
    self.$rootScope_.$apply(function() {
      if (response && response['error']) {
        defer.reject(response['error']);
      } else {
        defer.resolve(response);
      }
    });
  });
  return defer.promise;
};

/**
 * Controller for the authorize route, named 'googleapiAuthorizeCtrl'.
 * This can be used directly by name (the authorize and redirect method will be
 * available on the scope), or injected into a custom controller if desired.
 * @constructor
 * @param {!AuthorizeCtrlConfig} googleapiAuthorizeCtrlConfig configuration for
 *     auth controller.
 * @param {!oauth.OAuth} oauth The OAuth service.
 * @param {!angular.$location} $location The angular $location service.
 * @ngInject
 */
ng.googleapi.client.AuthorizeCtrl = function(googleapiAuthorizeCtrlConfig,
    oauth, $location) {
  /** @private {!AuthorizeCtrlConfig} */
  this.googleapiAuthorizeCtrlConfig_ = googleapiAuthorizeCtrlConfig;
  /** @private {!oauth.OAuth} */ this.oauth_ = oauth;
  /** @private {!angular.$location} */ this.$location_ = $location;
};

/**
 * Requests authorization by prompting the user. If an OAuth token is obtained,
 * redirect by calling redirect().
 * @expose
 */
ng.googleapi.client.AuthorizeCtrl.prototype.authorize = function() {
  this.oauth_.authorize().then(ng.googleapi.client.bind(this.redirect, this));
};

/**
 * Redirects the user after authentication is completed.
 * This sets $location.path to the value it had when the controller was created.
 * @expose
 */
ng.googleapi.client.AuthorizeCtrl.prototype.redirect = function() {
  this.$location_.path(this.googleapiAuthorizeCtrlConfig_.redirectPath || '/');
};

/**
 * State affecting usage of the AuthorizeCtrl controller.
 * authRoute is the path bound to the controller.
 * redirectPath is the path it should redirect to after authorization.
 * @typedef {{authRoute: string, redirectPath: ?string}}
 */
ng.googleapi.client.AuthorizeCtrlConfig;

/**
 * Partially applies this function to a particular 'this object' and zero or
 * more arguments. The result is a new function with some arguments of the
 * first function pre-filled and the value of |this| 'pre-specified'.
 *
 * Remaining arguments specified at call-time are appended to the pre-
 * specified ones.
 *
 * This method is carried over from the Google Closure JS library.
 */
ng.googleapi.client.bind = function(fn, selfObj, var_args) {
  return (fn.call.apply(fn.bind, arguments)).apply(null, arguments);
}

/** @type {!angular.Module}. */
ng.googleapi.client.module = angular.module('googleapi.client',
    [ng.googleapi.oauth.module.name, ng.googleapi.gapi.module.name]).
    constant('googleapiAuthorizeCtrlConfig', {
      redirectPath: null,
      authRoute: '/authorize'
    }).
    provider('googleapi', ng.googleapi.client.GoogleAPIProvider).
    service('googleapiAuthorizeCtrl', ng.googleapi.client.AuthorizeCtrl).
    config(['$controllerProvider', function($controllerProvider) {
      $controllerProvider.register('googleapiAuthorizeCtrl',
          ['googleapiAuthorizeCtrl', '$scope', function(ctrl, $scope) {
            $scope['authorize'] = ng.googleapi.client.bind(ctrl.authorize,
                ctrl);
            $scope['redirect'] = ng.googleapi.client.bind(ctrl.redirect,
                ctrl);
          }]);
    }]).
    run(['$rootScope', 'googleapi', function($rootScope, googleapi) {
      $rootScope.$on('$routeChangeError', function(e, current, previous, err) {
        if (err instanceof Error) {
          googleapi.showAuthPage_();
        }
      });
    }]);
