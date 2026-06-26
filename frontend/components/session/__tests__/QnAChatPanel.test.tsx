import React from "react";
import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import QnAChatPanel from "../QnAChatPanel";

describe("QnAChatPanel Component", () => {
  const defaultProps = {
    qaMessages: [],
    chatInput: "",
    setChatInput: vi.fn(),
    isPending: false,
    qaError: null,
    handleSendMessage: vi.fn((e) => e.preventDefault()),
  };

  test("renders welcome message when qaMessages list is empty", () => {
    render(<QnAChatPanel {...defaultProps} />);
    expect(screen.getByText(/Welcome! Stand 6 feet back/i)).toBeDefined();
  });

  test("renders message log correctly", () => {
    const qaMessages = [
      { sender: "user" as const, text: "How is my posture?" },
      { sender: "assistant" as const, text: "Keep your chest high." },
    ];
    render(<QnAChatPanel {...defaultProps} qaMessages={qaMessages} />);
    expect(screen.getByText("How is my posture?")).toBeDefined();
    expect(screen.getByText("Keep your chest high.")).toBeDefined();
  });

  test("shows shorter placeholder text when not pending", () => {
    render(<QnAChatPanel {...defaultProps} />);
    const input = screen.getByPlaceholderText("Ask about form...");
    expect(input).toBeDefined();
    expect(screen.getByText("Ask about movement setup or form correction tips.")).toBeDefined();
  });

  test("shows responding placeholder when pending", () => {
    render(<QnAChatPanel {...defaultProps} isPending={true} />);
    const input = screen.getByPlaceholderText("Responding...");
    expect(input).toBeDefined();
    expect(screen.getByText("Assistant is responding...")).toBeDefined();
  });

  test("submitting calls handleSendMessage", () => {
    const handleSendMessage = vi.fn((e) => e.preventDefault());
    render(<QnAChatPanel {...defaultProps} chatInput="Hello" handleSendMessage={handleSendMessage} />);
    const form = screen.getByRole("textbox").closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    expect(handleSendMessage).toHaveBeenCalledTimes(1);
  });
});
