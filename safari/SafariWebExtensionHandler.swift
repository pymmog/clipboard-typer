import SafariServices
import os.log
#if os(macOS)
import AppKit
#else
import UIKit
#endif

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        let message: Any?
        if #available(iOS 15.0, macOS 11.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }

        let payload = message as? [String: Any]
        let reply = clipboardReply(for: payload)

        let response = NSExtensionItem()
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [SFExtensionMessageKey: reply]
        } else {
            response.userInfo = ["message": reply]
        }

        context.completeRequest(returningItems: [response], completionHandler: nil)
    }

    private func clipboardReply(for payload: [String: Any]?) -> [String: Any] {
        guard payload?["type"] as? String == "READ_CLIPBOARD" else {
            return ["ok": false, "error": "Unknown message"]
        }

        let text: String
        #if os(macOS)
        text = NSPasteboard.general.string(forType: .string) ?? ""
        #else
        text = UIPasteboard.general.string ?? ""
        #endif
        return ["ok": true, "text": text]
    }
}
