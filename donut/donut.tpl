<template id="data-donut">
	<div class="data-cell data-donut">
		<data-common-header :page="page" :parameters="parameters" :cell="cell" :edit="edit" 
				:records="records"
				@updatedEvents="$emit('updatedEvents')"
				:configuring="configuring"
				@close="$emit('close'); configuring=false"
				:filters="filters"
				:paging="paging">
			<n-form-section slot="main-settings">
				<n-form-text v-model="cell.state.unit" label="Unit" :timeout="600" @input="draw" />
				<n-form-text v-model="cell.state.fromColor" type="color" label="From Color" :timeout="600" @input="draw" />
				<n-form-text v-model="cell.state.toColor" type="color" label="To Color" :timeout="600" @input="draw" />
				<n-form-text v-model="cell.state.arcWidth" type="range" :minimum="10" :maximum="90" label="Arc Width" :timeout="600" @input="draw"/>
				<n-form-combo v-model="cell.state.value" @input="draw" :required="true" label="Value Field" :filter="function() { return keys }"/>
				<n-form-combo v-model="cell.state.label" @input="draw" label="Label Field" :filter="function() { return keys }"/>
				<page-formatted-configure v-if="cell.state.label" :fragment="cell.state.labelFormat" :page="page" :cell="cell"/>
				<n-form-combo v-model="cell.state.detail" :items="['inline', 'popup']" label="Label Style" @input="draw"/>
			</n-form-section>
		</data-common-header>
		<svg ref="svg"></svg>
		<data-common-footer :page="page" :parameters="parameters" :cell="cell" 
			:edit="edit"
			:records="records"
			:selected="selected"
			:inactive="inactive"
			:global-actions="globalActions"
			@updatedEvents="$emit('updatedEvents')"
			@close="$emit('close'); configuring=false"
			:multiselect="true"
			:updatable="true"/>
	</div>
</template>