import { HintRow, PlainLine, StandardModal, standardModalDims, TextLine } from "./primitives.js"
import { colors } from "./colors.js"

export interface SettingsModalState {
	readonly themeSummary: string
	readonly selectedIndex: number
	readonly editingWorkspaceRoot: boolean
	readonly workspaceRootInput: string
	readonly epicMode: "assigned" | "searchable"
	readonly epicLabelFilter: string | null
	readonly systemThemeAutoReload: boolean
	readonly error: string | null
}

export const initialSettingsModalState: SettingsModalState = {
	themeSummary: "Open theme picker",
	selectedIndex: 0,
	editingWorkspaceRoot: false,
	workspaceRootInput: "",
	epicMode: "assigned",
	epicLabelFilter: null,
	systemThemeAutoReload: false,
	error: null,
}

const rows = (state: SettingsModalState) =>
	[
		{ key: "theme", label: "Theme picker", value: state.themeSummary },
		{
			key: "workspaceRoot",
			label: "Workspace root",
			value: state.editingWorkspaceRoot ? state.workspaceRootInput || "type a path..." : state.workspaceRootInput || "current directory",
		},
		{ key: "epicMode", label: "Epic mode", value: state.epicMode },
		{ key: "epicLabelFilter", label: "Epic label filter", value: state.epicLabelFilter ?? "off" },
		{ key: "systemThemeAutoReload", label: "System theme auto reload", value: state.systemThemeAutoReload ? "on" : "off" },
	] as const

export const SettingsModal = ({
	state,
	modalWidth,
	modalHeight,
	offsetLeft,
	offsetTop,
}: {
	readonly state: SettingsModalState
	readonly modalWidth: number
	readonly modalHeight: number
	readonly offsetLeft: number
	readonly offsetTop: number
}) => {
	const { contentWidth } = standardModalDims(modalWidth, modalHeight)
	const items = rows(state)
	return (
		<StandardModal
			left={offsetLeft}
			top={offsetTop}
			width={modalWidth}
			height={modalHeight}
			title="Settings"
			headerRight={{ text: `${Math.min(state.selectedIndex + 1, items.length)}/${items.length}` }}
			subtitle={<PlainLine text="Project-wide glabui preferences" fg={colors.muted} />}
			bodyPadding={1}
			footer={
				<HintRow
					items={
						state.editingWorkspaceRoot
							? [
									{ key: "enter", label: "save" },
									{ key: "esc", label: "cancel" },
								]
							: [
									{ key: "↑↓", label: "move" },
									{ key: "enter", label: "edit/toggle" },
									{ key: "space", label: "toggle" },
									{ key: "esc", label: "close" },
								]
					}
				/>
			}
		>
			{state.error ? <PlainLine text={state.error} fg={colors.error} /> : null}
			{items.map((item, index) => {
				const selected = index === Math.max(0, Math.min(state.selectedIndex, items.length - 1))
				return (
					<TextLine key={item.key} bg={selected ? colors.selectedBg : undefined} fg={selected ? colors.selectedText : colors.text}>
						<span fg={selected ? colors.accent : colors.muted}>{selected ? "▸" : " "}</span>
						<span>{` ${item.label.padEnd(Math.max(12, Math.min(24, contentWidth - 12)), " ")}`}</span>
						<span fg={selected ? colors.selectedText : colors.muted}>{item.value}</span>
					</TextLine>
				)
			})}
		</StandardModal>
	)
}
