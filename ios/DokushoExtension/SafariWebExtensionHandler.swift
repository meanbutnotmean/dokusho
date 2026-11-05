import SafariServices

final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        // The extension currently runs entirely in its WebExtension resources.
        context.completeRequest(returningItems: nil)
    }
}
