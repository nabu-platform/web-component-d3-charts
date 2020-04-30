<template id="data-gauge">
	<div class="data-cell data-gauge">
		<data-common-header :page="page" :parameters="parameters" :cell="cell" :edit="edit" 
				:records="records"
				@updatedEvents="$emit('updatedEvents')"
				:configuring="configuring"
				@close="$emit('close'); configuring=false"
				:filters="filters"
				:paging="paging">
			<n-form-section slot="main-settings">
				<n-form-text v-model="cell.state.valueColor" type="color" label="Value Color" :timeout="600" @input="draw" />
				<n-form-text v-model="cell.state.totalColor" type="color" label="Total Color" :timeout="600" @input="draw" />
				<n-form-combo v-model="cell.state.value" @input="draw" :required="true" label="Gauge Value Field" :filter="function() { return keys }"/>
				<n-form-combo v-model="cell.state.totalValue" @input="draw" label="Total Value Field" :filter="function() { return keys }"/>
				<n-form-combo v-model="cell.state.label" @input="draw" label="Label Field" :filter="function() { return keys }"/>
				<n-form-switch v-model="cell.state.showValue" @input="draw" label="Show value" />
				<n-form-text v-model="cell.state.unit" label="Unit" :timeout="600" @input="draw" />
				<n-form-text v-model="cell.state.round" label="Rounding" :timeout="600" @input="draw" />
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