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
 * @fileoverview AngularJS module providing access to google API client object
 * (gapi) as a service, and allowing providers to register hooks which should
 * be executed prior to injection.
 */
var ng = ng || {};
ng.googleapi = ng.googleapi || {};
ng.googleapi.gapi = ng.googleapi.gapi || {};
ng.googleapi.oauth = ng.googleapi.oauth || {};
ng.googleapi.client = ng.googleapi.client || {};

/**
 * Gapi service provider, used to register hooks that should complete before
 * gapi is provided.
 * @constructor
 */
ng.googleapi.gapi.GapiProvider = function() {
  /** @private {Array.<ng.googleapi.gapi.Hook>} */ this.hooks_ = [];
};

/**
 * Add an injectable hook that should be executed before providing gapi.
 * If the hook returns a promise, that promise will also be resolved.
 * In addition to standard services and opt_locals, the gapi object can be
 * injected as partialGapi.
 * @param {Function|!Array.<string|Function>} hook The hook to execute.
 * @param {Object=} opt_this The this object for the hook.
 * @param {Object.<string, ?>=} opt_locals Map of local variables for injection.
 */
ng.googleapi.gapi.GapiProvider.prototype.hook = function(hook, opt_this,
    opt_locals) {
  this.hooks_.push({
    hook: hook,
    self: opt_this,
    locals: opt_locals
  });
};

/**
 * Creates the gapi service.
 * @param {!Window} $window Global object.
 * @param {!angular.$q} $q Angular $q service.
 * @param {!angular.$injector} $injector Angular $injector service.
 * @return {!angular.$q.Promise} Promise of the google API client.
 * @ngInject
 */
ng.googleapi.gapi.GapiProvider.prototype.$get = function($window, $q,
    $injector) {
  var gapi = $window['gapi'];
  if (!gapi) throw new Error('client.js not loaded!');
  var results = [];
  angular.forEach(this.hooks_, function(hook) {
    results.push($q.when($injector.invoke(
      hook.hook,
      hook.self,
      angular.extend({'partialGapi': gapi}, hook.locals)
    )));
  });
  return $q.all(results).then(function() { return gapi; });
};

/**
 * Internal representation of a hook.
 * @typedef {{
 *   hook: (Function|!Array.<string|Function>),
 *   self: ?Object,
 *   locals: ?Object
 * }}
 */
ng.googleapi.gapi.Hook;

/** @type {!angular.Module}. */
ng.googleapi.gapi.module = angular.
    module('googleapi.gapi', []).
    provider('gapi', ng.googleapi.gapi.GapiProvider);
