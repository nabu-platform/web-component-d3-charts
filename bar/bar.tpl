<template id="data-bar">
	<div class="data-cell data-bar">
		<data-common-header :page="page" :parameters="parameters" :cell="cell" :edit="edit"
				:records="records"
				@updatedEvents="$emit('updatedEvents')"
				:configuring="configuring"
				@close="$emit('close'); configuring=false"
				:filters="filters"
				:paging="paging">
			<n-form-section slot="main-settings">
				<n-form-text v-model="cell.state.unit" label="Unit" :timeout="600" @input="draw" />
				<n-form-text v-model="cell.state.fromColor" type="color" :label="cell.state.z ? 'From Color' : 'Color'" :timeout="600" @input="draw" />
				<n-form-text v-model="cell.state.toColor" v-if="cell.state.z" type="color" label="To Color" :timeout="600" @input="draw" />
				<n-form-combo v-model="cell.state.x" @input="draw" label="X Field" :filter="function() { return keys }"/>
				<page-formatted-configure v-if="cell.state.x" :fragment="cell.state.xFormat" :page="page" :cell="cell"/>
				<n-form-combo v-model="cell.state.y" @input="draw" :required="true" label="Y Field" :filter="function() { return keys }"/>
				<page-formatted-configure v-if="cell.state.y" :fragment="cell.state.yFormat" :page="page" :cell="cell"/>
				<n-form-combo v-model="cell.state.z" @input="draw" label="Z Field" :filter="function() { return keys }"/>
				<page-formatted-configure v-if="cell.state.z" :fragment="cell.state.zFormat" :page="page" :cell="cell"/>
				<n-form-combo v-model="cell.state.groupType" v-if="cell.state.z" @input="draw" label="Group Type" :items="['stacked', 'grouped']"/>
				<n-form-text type="range" v-model="cell.state.rotateX" :minimum="0" :maximum="90" label="Rotation X Label" :timeout="600" @input="draw"/>
				<n-form-text v-model="cell.state.yLabel" label="Y-Axis Label" :timeout="600" @input="draw" />
				<n-form-switch v-model="cell.state.legend" label="Legend" @input="draw"/>
				<n-form-combo v-model="cell.state.sortBy" @input="draw" label="Sort By" :items="['x', 'y']"/>
				<n-form-switch v-model="cell.state.reverseSortBy" v-if="cell.state.orderBy" label="Reverse Sort By" @input="draw"/>
				<n-form-text v-model="cell.state.maxBarWidth" label="Max Bar Width" type="number"/>
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