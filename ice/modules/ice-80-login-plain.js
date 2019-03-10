/**
 * @file Ingress-ICE, everything related to plain login
 * @license MIT
 */

/*global announce */
/*global config */
/*global page */
/*global system */
/*global prepare */
/*global hideDebris */
/*global setMinMax */
/*global addIitc */
/*global twostep */
/*global loginTimeout */
/*global quit */
/*global storeCookies */
/*global main */

/**
 * Fires plain login
 */
function firePlainLogin() {
  page.settings.userAgent = 'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10.5; en-US; rv:1.9.1b3) Gecko/20090305 Firefox/3.1b3 GTB5';
  page.open('https://www.ingress.com/intel', function (status) {

    if (status !== 'success') {quit('unable to connect to remote server')}

    var link = page.evaluate(function () {
      return document.getElementsByTagName('a')[0].href;
    });

    announce('Logging in...');
    page.open(link, function () {
      login(config.login, config.password);
    });
  });
}

/**
 * Log in to google. Doesn't use post, because URI may change.
 * Fixed in 3.0.0 -- obsolete versions will not work (google changed login form)
 * @param l - google login
 * @param p - google password
 */
function login(l, p) {
  page.evaluate(function (l) {
    document.getElementById('Email').value = l;
  }, l);
  page.evaluate(function () {
    document.querySelector("#next").click();
  });
  window.setTimeout(function () {
    page.evaluate(function (p) {
      document.getElementById('Passwd').value = p;
    }, p);
    page.evaluate(function () {
      document.querySelector("#next").click();
    });
    page.evaluate(function () {
      document.getElementById('gaia_loginform').submit();
    });
    window.setTimeout(function () {
      announce('Validating login credentials...');
      if (page.url.substring(0,43) === 'https://accounts.google.com/signin/rejected') {
        quit("Couldn't sign you in: The browser you're using doesn't support JavaScript, or has JavaScript turned off.");
      }

      if (page.url.substring(0,40) === 'https://accounts.google.com/ServiceLogin') {
        quit('login failed: wrong email and/or password');
      }

      if (page.url.substring(0,40) === 'https://appengine.google.com/_ah/loginfo') {
        announce('Accepting appEngine request...');
        page.evaluate(function () {
          document.getElementById('persist_checkbox').checked = true;
          document.getElementsByTagName('form').submit();
        });
      }

      if (page.url.substring(0,44) === 'https://accounts.google.com/signin/challenge') {
        var totpPin = page.evaluate(function () { return document.getElementById('totpPin'); });
        if (!totpPin) {
          azApprovalMsg = page.evaluate(function () { return document.getElementById('azApprovalMsg').textContent; });
          if (azApprovalMsg) {
            awaitApproval(azApprovalMsg);
          }
          else {
            announce('No approval message found. Submit a challenge request.');
            page.evaluate(function () { document.getElementById('challenge').submit(); });
            window.setTimeout(function () {
              azApprovalMsg = page.evaluate(function () { return document.getElementById('azApprovalMsg').textContent; });
              if (azApprovalMsg) {
                awaitApproval(azApprovalMsg);
              }
              else {
                window.setTimeout(afterPlainLogin, loginTimeout);
              }
            }, loginTimeout);
          }
        }
        else {
          announce('Using two-step verification, please enter your code:');
          twostep = system.stdin.readLine();
        }
        if (twostep) {
          page.evaluate(function (code) {
            document.getElementById('totpPin').value = code;
          }, twostep);
          page.evaluate(function () {
            document.getElementById('submit').click();
            document.getElementById('challenge').submit();
          });
        }
        window.setTimeout(afterPlainLogin, loginTimeout);
      }
      else {
        window.setTimeout(afterPlainLogin, loginTimeout);
      }
    }, loginTimeout)
  }, loginTimeout / 10);
}

/**
 * await smartphone approval
 * @since 4.3.4
 */
function awaitApproval(azApprovalMsg) {
  announce(azApprovalMsg);
  announce('Please enter to continue after sign in with your phone:');
  system.stdin.readLine();
  page.evaluate(function () {
    document.getElementById('submit').click();
    document.getElementById('challenge').submit();
  });
  window.setTimeout(afterPlainLogin, loginTimeout);
}

/**
 * Does all stuff needed after login/password authentication
 * @since 3.1.0
 */
function afterPlainLogin() {
  page.open(config.area, function() {
    if (!isSignedIn()) {
      announce('Something went wrong. Please, sign in to Google via your browser and restart ICE. Don\'t worry, your Ingress account will not be affected.');
      quit();
    }
    window.setTimeout(function() {
      storeCookies();
      if (config.iitc) {
        addIitc();
      }
      setTimeout(function() {
        announce('Will start screenshooting in ' + config.delay/1000 + ' seconds...');
        if (((config.minlevel > 1)||(config.maxlevel < 8)) && !config.iitc) {
          setMinMax(config.minlevel, config.maxlevel);
        } else if (!config.iitc) {
          page.evaluate(function() {
            document.querySelector("#filters_container").style.display= 'none';
          });
        }
        hideDebris(config.iitc);
        prepare(config.iitc, config.width, config.height);
        announce('The first screenshot may not contain all portals, it is intended for you to check framing.');
        main();
        setInterval(main, config.delay);
      }, loginTimeout);
    }, loginTimeout/10);
  });
}
