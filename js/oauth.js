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
 * @fileoverview AngularJS service for google.com OAuth2 flows, wrapping
 * gapi.auth. This is used internally by the googleapi module to manage
 * authorization state.
 */
var ng = ng || {};
ng.googleapi = ng.googleapi || {};
ng.googleapi.gapi = ng.googleapi.gapi || {};
ng.googleapi.oauth = ng.googleapi.oauth || {};
ng.googleapi.client = ng.googleapi.client || {};

/**
 * OAuth service provider, to allow for configuration.
 * @constructor
 * @param {!gapi.GapiProvider} gapiProvider Google API provider config.
 * @ngInject
 */
ng.googleapi.oauth.OAuthProvider = function(gapiProvider) {
  /** @private {!Array.<string>} */ this.scopes = [];
  /** @private {?string} */ this.clientId = null;
  /** @private {Object.<string>} */ this.params = null;
  gapiProvider.hook(this.loadAuthIfNeeded_, this);
};

/**
 * Loads gapi's "auth" module if OAuth is required.
 * @param {?} partialGapi Google API client.
 * @param {!angular.$q} $q Angular $q service.
 * @param {!angular.Scope} $rootScope Root application scope.
 * @return {?angular.$q.Promise} Promise resolved once loading is complete.
 * @ngInject
 * @private
 */
ng.googleapi.oauth.OAuthProvider.prototype.loadAuthIfNeeded_ = function(
    partialGapi, $q, $rootScope) {
  if (this.scopes.length) {
    var defer = $q.defer();
    partialGapi.load('auth', function() {
      $rootScope.$apply(function() { defer.resolve(); });
    });
    return defer.promise;
  }
};

/**
 * Obtains the OAuth service.
 * @param {!angular.$injector} $injector The angular $injector service.
 * @return {!OAuth} The OAuth service.
 * @expose
 * @ngInject
 */
ng.googleapi.oauth.OAuthProvider.prototype.$get = function($injector) {
  if (this.scopes.length && !this.clientId) {
    throw new Error('OAuth scopes specified, but no Client ID!');
  }
  return /** @type {!OAuth} */ ($injector.instantiate(
      ng.googleapi.oauth.OAuth, {
    'scopes': this.scopes,
    'clientId': this.clientId,
    'params': this.params
  }));
};

/**
 * OAuth service.
 * @constructor
 * @param {!Array.<string>} scopes The OAuth scopes to request.
 * @param {?string} clientId The unique identifier of the client application.
 * @param {Object.<string>} params Extra parameters to be passed to
 *     the authorization request.
 * @param {!angular.$q} $q The angular $q service.
 * @param {!angular.Scope} $rootScope The application root scope.
 * @param {!angular.$q.Promise} gapi A promise of the google API client.
 * @ngInject
 */
ng.googleapi.oauth.OAuth = function(scopes, clientId, params, $q, $rootScope,
    gapi) {
  /** @private {!Array.<string>} */ this.scopes_ = scopes;
  /** @private {?string} */ this.clientId_ = clientId;
  /** @private {Object.<string>} */ this.params_ = params;
  /** @private {!angular.$q} */ this.$q_ = $q;
  /** @private {!angular.Scope} */ this.$rootScope_ = $rootScope;
  /** @private {!angular.$q.Promise} */ this.gapi_ = gapi;
};

/**
 * Performs OAuth authorization flow.
 * @param {boolean} immediate In immediate mode, the auth flow will not prompt
 *     the user (and will fail unless the app has been previously authorized
 *     for the requested scopes).
 * @return {!angular.$q.Promise} A promise of the OAuth token.
 * @private
 */
ng.googleapi.oauth.OAuth.prototype.authorize_ = function(immediate) {
  if (!this.scopes_.length) throw new Error('No OAuth scopes requested');
  var opts = {
    'client_id': this.clientId_,
    'immediate': immediate,
    'scope': this.scopes_
  };
  for (var key in this.params_) {
    opts[key] = this.params_[key];
  }
  var self = this;
  return this.gapi_.then(function(gapi) {
    var defer = self.$q_.defer();
    gapi.auth.authorize(opts, function(token) {
      self.$rootScope_.$apply(function() {
        if (!token) {
          defer.reject(new Error('No token returned'));
        } else if (token['error']) {
          defer.reject(new Error(token['error']));
        } else {
          defer.resolve(token);
        }
      });
    });
    return defer.promise;
  });
};

/**
 * Attempts to obtain an OAuth token without prompting the user.
 * @return {!angular.$q.Promise} A promise which will be resolved if a token
 *     could be obtained, and rejected otherwise.
 */
ng.googleapi.oauth.OAuth.prototype.authorizeImmediate = function() {
  if (!this.scopes_.length) return this.$q_.when(null); // None needed.
  if (!this.lastPromise_) this.lastPromise_ = this.authorize_(true);
  return this.lastPromise_;
};

/**
 * Attempts to obtain an OAuth token by prompting the user.
 * @return {!angular.$q.Promise} A promise which will be resolved if a token
 *     could be obtained, and rejected otherwise.
 */
ng.googleapi.oauth.OAuth.prototype.authorize = function() {
  return this.lastPromise_ = this.authorize_(false);
};

/** @type {!angular.Module}. */
ng.googleapi.oauth.module = angular.
    module('googleapi.oauth', [ng.googleapi.gapi.module.name]).
    provider('oauth', ng.googleapi.oauth.OAuthProvider).
    run(['oauth', function(oauth) { oauth.authorizeImmediate(); }]);
