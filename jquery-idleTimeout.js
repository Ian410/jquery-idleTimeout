/**
 * This work is licensed under the MIT License
 *
 * Configurable idle (no activity) timer and logout redirect for jQuery.
 * Works across multiple windows and tabs from the same domain.
 *
 * Dependencies: JQuery v1.7+, JQuery UI, store.js from https://github.com/marcuswestin/store.js - v1.3.4+
 * version 1.0.6
 **/

/*global jQuery: false, document: false, store: false, clearInterval: false, setInterval: false, setTimeout: false, window: false, alert: false*/
/*jslint indent: 2, sloppy: true*/

(function ($) {

  $.fn.idleTimeout = function (options) {

    //##############################
    //## Configuration Variables
    //##############################
    var defaults = {
      idleTimeLimit: 1200000,       // 'No activity' time limit in milliseconds. 1200000 = 20 Minutes
      dialogDisplayLimit: 180000,   // Time to display the warning dialog before redirect (and optional callback) in milliseconds. 180000 = 3 Minutes
      redirectUrl: '/logout',       // redirect to this url on timeout logout. Set to "redirectUrl: false" to disable redirect
      // optional custom callback to perform before redirect
      customCallback: false,       // set to false for no customCallback
      // customCallback:    function () {    // define optional custom js function
          // perform custom action before logout redirect
      // },

      // configure which activity events to detect
      // http://www.quirksmode.org/dom/events/
      // https://developer.mozilla.org/en-US/docs/Web/Reference/Events
      activityEvents: 'click keypress scroll wheel mousewheel mousemove', // separate each event with a space

      //dialog box configuration
      enableDialog: true,
      dialogTitle: 'Session Expiration Warning',
      dialogText: 'Because you have been inactive, your session is about to expire.',

      // server-side session keep-alive timer
      sessionKeepAliveTimer: 600000 // Ping the server at this interval in milliseconds. 600000 = 10 Minutes
      // sessionKeepAliveTimer: false // Set to false to disable pings
    },

    //##############################
    //## Private Variables
    //##############################
      opts = $.extend(defaults, options),
      checkHeartbeat = 2000, // frequency to check for timeouts - 2000 = 2 seconds
      origTitle = document.title, // save original browser title
      sessionKeepAliveUrl = window.location.href, // set URL to ping to user's current window
      keepSessionAlive, activityDetector,
      idleTimer, remainingTimer, checkIdleTimeout, idleTimerLastActivity, startIdleTimer, stopIdleTimer,
      openWarningDialog, dialogTimer, checkDialogTimeout, startDialogTimer, stopDialogTimer, isDialogOpen, destroyWarningDialog,
      countdownDisplay, logoutUser;

    //##############################
    //## Private Functions
    //##############################
    keepSessionAlive = function () {

      if (opts.sessionKeepAliveTimer) {
        var keepSession = function () {
          if (idleTimerLastActivity === store.get('idleTimerLastActivity')) {
            $.get(sessionKeepAliveUrl);
          }
        };

        setInterval(keepSession, opts.sessionKeepAliveTimer);
      }
    };

    activityDetector = function () {

      $('body').on(opts.activityEvents, function () {

        if (isDialogOpen() !== true) {
          startIdleTimer();
        }
      });
    };

    checkIdleTimeout = function () {
      var timeNow = $.now(), timeIdleTimeout = (store.get('idleTimerLastActivity') + opts.idleTimeLimit);

      if (timeNow > timeIdleTimeout) {
        if (isDialogOpen() !== true) {
          if (opts.enableDialog) {
            openWarningDialog();
          }
          startDialogTimer();
        }
      } else if (store.get('idleTimerLoggedOut') === true) { //a 'manual' user logout?
        logoutUser();
      } else {
        if (isDialogOpen() === true) {
          destroyWarningDialog();
          stopDialogTimer();
        }
      }
    };

    startIdleTimer = function () {
      stopIdleTimer();
      idleTimerLastActivity = $.now();
      store.set('idleTimerLastActivity', idleTimerLastActivity);
      idleTimer = setInterval(checkIdleTimeout, checkHeartbeat);
    };

    stopIdleTimer = function () {
      clearInterval(idleTimer);
    };

    openWarningDialog = function () {
      var dialogContent = "<div id='idletimer_warning_dialog'><p>" + opts.dialogText + "</p><p style='display:inline'>Time remaining: <div style='display:inline' id='countdownDisplay'></div></p></div>";

      $(dialogContent).dialog({
        buttons: {
          "Stay Logged In": function () {
            destroyWarningDialog();
            stopDialogTimer();
            startIdleTimer();
          },
          "Log Out Now": function () {
            logoutUser();
          }
        },
        closeOnEscape: false,
        modal: true,
        title: opts.dialogTitle
      });

      // hide the dialog's upper right corner "x" close button
      $('.ui-dialog-titlebar-close').css('display', 'none');

      // start the countdown display
      countdownDisplay();

      document.title = opts.dialogTitle;
    };

    checkDialogTimeout = function () {
      var timeNow = $.now(), timeDialogTimeout = (store.get('idleTimerLastActivity') + opts.idleTimeLimit + opts.dialogDisplayLimit);

      if ((timeNow > timeDialogTimeout) || (store.get('idleTimerLoggedOut') === true)) {
        logoutUser();
      }
    };

    startDialogTimer = function () {
      dialogTimer = setInterval(checkDialogTimeout, checkHeartbeat);
    };

    stopDialogTimer = function () {
      clearInterval(dialogTimer);
      clearInterval(remainingTimer);
    };

    isDialogOpen = function () {
      var dialogOpen = $("#idletimer_warning_dialog").is(":visible");

      if (dialogOpen === true) {
        return true;
      }
      return false;
    };

    destroyWarningDialog = function () {
      $(".ui-dialog-content").dialog('destroy').remove();
      document.title = origTitle;
    };

    // display remaining time on warning dialog
    countdownDisplay = function () {
      var dialogDisplaySeconds = opts.dialogDisplayLimit / 1000, mins, secs;

      remainingTimer = setInterval(function () {
        mins = Math.floor(dialogDisplaySeconds / 60); // minutes
        if (mins < 10) { mins = '0' + mins; }
        secs = dialogDisplaySeconds - (mins * 60); // seconds
        if (secs < 10) { secs = '0' + secs; }
        $('#countdownDisplay').html(mins + ':' + secs);
        dialogDisplaySeconds -= 1;
      }, 1000);
    };

    logoutUser = function () {
      store.set('idleTimerLoggedOut', true);

      if (opts.customCallback) {
        opts.customCallback();
      }

      if (opts.redirectUrl) {
        window.location.href = opts.redirectUrl;
      }
    };

    //###############################
    // Build & Return the instance of the item as a plugin
    // This is your construct.
    //###############################
    return this.each(function () {

      if (store.enabled) {
        idleTimerLastActivity = $.now();
        store.set('idleTimerLastActivity', idleTimerLastActivity);
        store.set('idleTimerLoggedOut', false);
      } else {
        alert('Please disable "Private Mode", or upgrade to a modern browser. Or perhaps a dependent file missing. Please see: https://github.com/marcuswestin/store.js');
      }

      activityDetector();

      keepSessionAlive();

      startIdleTimer();
    });
  };
}(jQuery));
