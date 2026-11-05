import SwiftUI
import UIKit

@main
struct DokushoApp: App {
    var body: some Scene {
        WindowGroup {
            WelcomeView()
        }
    }
}

private struct WelcomeView: View {
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Dokusho")
                            .font(.largeTitle.bold())
                        Text("Tra từ tiếng Nhật ngay khi đọc web trong Safari.")
                            .font(.title3)
                            .foregroundStyle(.secondary)
                    }

                    instruction(number: "1", title: "Bật tiện ích trong Safari", detail: "Mở Cài đặt > Ứng dụng > Safari > Tiện ích mở rộng, chọn Dokusho và bật quyền truy cập trang web.")
                    instruction(number: "2", title: "Thêm từ điển của bạn", detail: "Mở Safari, nhấn nút Tiện ích mở rộng rồi chọn Dokusho. Mở mục Từ điển và nhập file ZIP tương thích Yomitan từ ứng dụng Tệp.")
                    instruction(number: "3", title: "Tra từ khi đọc", detail: "Chạm vào từ tiếng Nhật hoặc bôi đen từ để xem nghĩa. Bạn có thể mở một từ khác ngay trong phần định nghĩa.")

                    Label("Từ điển được lưu trên thiết bị. Dokusho không gửi nội dung từ điển lên máy chủ.", systemImage: "lock.shield")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .padding(.top, 4)
                }
                .padding(24)
                .frame(maxWidth: 620, alignment: .leading)
                .frame(maxWidth: .infinity)
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("Bắt đầu")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func instruction(number: String, title: String, detail: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Text(number)
                .font(.headline)
                .foregroundStyle(.white)
                .frame(width: 30, height: 30)
                .background(Color.accentColor, in: Circle())
            VStack(alignment: .leading, spacing: 5) {
                Text(title).font(.headline)
                Text(detail).font(.subheadline).foregroundStyle(.secondary)
            }
        }
    }
}
