import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

// Capacitor's WKWebView reports env(safe-area-inset-*) as 0, so feed the real
// native safe-area insets to the web layer as CSS variables (--safe-top/-bottom).
class MainViewController: CAPBridgeViewController {
    private var observing = false

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        if !observing, let wv = webView {
            // Don't let the scroll view shift content up for the safe area —
            // the CSS padding (driven by --safe-top) is the sole control.
            wv.scrollView.contentInsetAdjustmentBehavior = .never
            wv.addObserver(self, forKeyPath: "loading", options: [.new], context: nil)
            observing = true
        }
        applySafeAreaInsets()
    }

    deinit {
        if observing { webView?.removeObserver(self, forKeyPath: "loading") }
    }

    // Inject once the page has finished loading so the variable lands on the
    // real document (earlier injections hit a document that gets replaced).
    override func observeValue(forKeyPath keyPath: String?, of object: Any?, change: [NSKeyValueChangeKey: Any]?, context: UnsafeMutableRawPointer?) {
        if keyPath == "loading", let isLoading = change?[.newKey] as? Bool, isLoading == false {
            applySafeAreaInsets()
        }
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        applySafeAreaInsets()
    }

    private func applySafeAreaInsets() {
        let top = Int(view.safeAreaInsets.top)
        let bottom = Int(view.safeAreaInsets.bottom)
        let js = "document.documentElement.style.setProperty('--safe-top','\(top)px');"
            + "document.documentElement.style.setProperty('--safe-bottom','\(bottom)px');"
        webView?.evaluateJavaScript(js, completionHandler: nil)
    }
}
