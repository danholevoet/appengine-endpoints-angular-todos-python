
/**
 * @param {!ng.googleapi.client.GoogleAPIProvider} googleapiProvider
 * @param {!angular.$routeProvider} $routeProvider
 * @ngInject
 */
function configure(googleapiProvider, $routeProvider) {
  googleapiProvider.
      api('calendar', 'v3').
      scope('https://www.googleapis.com/auth/calendar.readonly').
      clientId('702438723626.apps.googleusercontent.com');

  $routeProvider.
      when('/public', {
        template: 'This page does not require auth'
      }).
      when('/private', {
        template: 'This pages accesses APIs and requires auth<ul>' +
           '<li ng-repeat="c in calendars.items">{{c.summary}}</li>',
        resolve: googleapiProvider.resolve(['calendar']),
        controller: ['calendar', 'googleapi', '$scope',
            /**
             * @param {!gapi.client.Calendar} calendar
             * @param {!ng.googleapi.client.GoogleAPI} googleapi
             * @param {!angular.Scope} $scope
             */
            function(calendar, googleapi, $scope) {
              // Quoted access to work around JSCompiler externs bug
              // http://code.google.com/p/closure-compiler/issues/detail?id=1165
              googleapi.execute(calendar['calendarList']['list']()).
                  then(function(result) {
                    $scope['calendars'] = result;
                  });
            }]
      }).
      when('/authorize', {
        template: '<button ng-click="authorize()">Authorize</button>',
        controller: 'googleapiAuthorizeCtrl'
      }).
      otherwise({redirectTo: '/public'});
}

angular.module('demo', ['ngRoute', ng.googleapi.client.module.name]).
    config(configure);